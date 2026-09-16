use http::{
    header::{ACCEPT_RANGES, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE, RANGE},
    response::Builder as ResponseBuilder,
    StatusCode,
};
use http_range::HttpRange;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    io::{Read, Seek, SeekFrom},
    path::{Component, Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, RwLock,
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager, State};

struct VideoSource(Arc<RwLock<Option<PathBuf>>>);
struct DirtyState(AtomicBool);

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoManifest {
    path: String,
    original_filename: String,
    size: u64,
    r#type: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    format: String,
    schema_version: u32,
    project_id: String,
    title: String,
    created_at: String,
    updated_at: String,
    video: VideoManifest,
    annotations_path: String,
    last_playhead_us: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnnotationFile {
    schema_version: u32,
    annotations: Vec<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    organization: Option<Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeProject {
    title: String,
    project_id: String,
    created_at: String,
    last_playhead_us: u64,
    annotations: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    organization: Option<Value>,
    video_path: String,
    project_dir: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeSaveResult {
    project_dir: String,
    video_path: String,
}

fn safe_name(value: &str) -> String {
    let result: String = value
        .chars()
        .map(|character| {
            if character.is_control() || "\\/:*?\"<>|".contains(character) {
                '_'
            } else {
                character
            }
        })
        .collect();
    let trimmed = result.trim();
    if trimmed.is_empty() {
        "match-video".into()
    } else {
        trimmed.into()
    }
}

fn media_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "mp4" | "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        "avi" => "video/x-msvideo",
        "mkv" => "video/x-matroska",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
fn prepare_video(path: String, source: State<'_, VideoSource>) -> Result<String, String> {
    let path = PathBuf::from(path);
    if !path.is_file() {
        return Err("The selected video no longer exists.".into());
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("The video path could not be opened: {error}"))?;
    let mime = media_type(&canonical).to_string();
    *source
        .0
        .write()
        .map_err(|_| "The video source lock is unavailable.".to_string())? = Some(canonical);
    Ok(mime)
}

#[tauri::command]
fn set_dirty_state(dirty: bool, state: State<'_, DirtyState>) {
    state.0.store(dirty, Ordering::SeqCst);
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle, state: State<'_, DirtyState>) {
    state.0.store(false, Ordering::SeqCst);
    app.exit(0);
}

fn stream_response(
    request: http::Request<Vec<u8>>,
    source: &Arc<RwLock<Option<PathBuf>>>,
) -> Result<http::Response<Vec<u8>>, String> {
    let path = source
        .read()
        .map_err(|_| "The video source lock is unavailable.".to_string())?
        .clone()
        .ok_or_else(|| "No video has been selected.".to_string())?;
    let mut file = fs::File::open(&path).map_err(|error| error.to_string())?;
    let length = file.metadata().map_err(|error| error.to_string())?.len();
    let response = ResponseBuilder::new()
        .header(CONTENT_TYPE, media_type(&path))
        .header(ACCEPT_RANGES, "bytes");

    if let Some(range_header) = request.headers().get(RANGE) {
        let ranges = HttpRange::parse(
            range_header
                .to_str()
                .map_err(|_| "The video byte range is invalid.".to_string())?,
            length,
        )
        .map_err(|_| "The requested video byte range cannot be served.".to_string())?;
        let range = ranges
            .first()
            .ok_or_else(|| "The requested video byte range is empty.".to_string())?;
        let start = range.start;
        let bytes_to_read = range.length.min(4 * 1024 * 1024);
        if start >= length || bytes_to_read == 0 {
            return ResponseBuilder::new()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header(CONTENT_RANGE, format!("bytes */{length}"))
                .body(Vec::new())
                .map_err(|error| error.to_string());
        }
        let end = start + bytes_to_read - 1;
        let mut buffer = Vec::with_capacity(bytes_to_read as usize);
        file.seek(SeekFrom::Start(start))
            .map_err(|error| error.to_string())?;
        file.take(bytes_to_read)
            .read_to_end(&mut buffer)
            .map_err(|error| error.to_string())?;
        response
            .status(StatusCode::PARTIAL_CONTENT)
            .header(CONTENT_RANGE, format!("bytes {start}-{end}/{length}"))
            .header(CONTENT_LENGTH, buffer.len())
            .body(buffer)
            .map_err(|error| error.to_string())
    } else {
        let mut buffer = Vec::with_capacity(length.min(4 * 1024 * 1024) as usize);
        file.read_to_end(&mut buffer)
            .map_err(|error| error.to_string())?;
        response
            .header(CONTENT_LENGTH, buffer.len())
            .body(buffer)
            .map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn save_project(
    source_video_path: String,
    destination_dir: Option<String>,
    existing_project_dir: Option<String>,
    title: String,
    project_id: String,
    created_at: String,
    updated_at: String,
    last_playhead_us: u64,
    annotations: Vec<Value>,
    organization: Value,
) -> Result<NativeSaveResult, String> {
    let source = PathBuf::from(&source_video_path);
    if !source.is_file() {
        return Err("The selected source video no longer exists.".into());
    }
    let video_name = safe_name(
        source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("match-video"),
    );
    let (destination, target) = if let Some(existing) = existing_project_dir {
        let target = PathBuf::from(existing);
        if !target.is_dir() {
            return Err("The existing Project folder is no longer available.".into());
        }
        let current: Manifest = serde_json::from_slice(
            &fs::read(target.join("manifest.json"))
                .map_err(|_| "The existing Project manifest is missing.".to_string())?,
        )
        .map_err(|_| "The existing Project manifest is damaged.".to_string())?;
        if current.format != "match-video-project" || current.project_id != project_id {
            return Err("The existing folder no longer matches this Project.".into());
        }
        let parent = target
            .parent()
            .ok_or_else(|| "The existing Project has no writable parent folder.".to_string())?
            .to_path_buf();
        (parent, target)
    } else {
        let destination = PathBuf::from(
            destination_dir.ok_or_else(|| "Choose a destination folder.".to_string())?,
        );
        if !destination.is_dir() {
            return Err("Choose an existing destination folder.".into());
        }
        let project_name = format!("{}.matchproject", safe_name(&title));
        let target = destination.join(project_name);
        (destination, target)
    };
    let saved_video_path = target.join("video").join(&video_name);
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary = destination.join(format!(".game-note-{stamp}.tmp"));
    let backup = destination.join(format!(".game-note-{stamp}.backup"));

    let save_result = (|| -> Result<(), String> {
        fs::create_dir_all(temporary.join("video")).map_err(|error| error.to_string())?;
        let video_size = fs::copy(&source, temporary.join("video").join(&video_name))
            .map_err(|error| error.to_string())?;
        let manifest = Manifest {
            format: "match-video-project".into(),
            schema_version: 1,
            project_id,
            title,
            created_at,
            updated_at,
            video: VideoManifest {
                path: format!("video/{video_name}"),
                original_filename: video_name.clone(),
                size: video_size,
                r#type: media_type(&source).into(),
            },
            annotations_path: "annotations.json".into(),
            last_playhead_us,
        };
        let annotation_file = AnnotationFile {
            schema_version: 1,
            annotations,
            organization: Some(organization),
        };
        fs::write(
            temporary.join("manifest.json"),
            serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;
        fs::write(
            temporary.join("annotations.json"),
            serde_json::to_vec_pretty(&annotation_file).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;

        if target.exists() {
            fs::rename(&target, &backup).map_err(|error| {
                format!("Could not prepare the existing project for update: {error}")
            })?;
        }
        if let Err(error) = fs::rename(&temporary, &target) {
            if backup.exists() {
                let _ = fs::rename(&backup, &target);
            }
            return Err(format!("Could not finish saving the project: {error}"));
        }
        if backup.exists() {
            fs::remove_dir_all(&backup).map_err(|error| {
                format!("Project saved, but its temporary backup could not be removed: {error}")
            })?;
        }
        Ok(())
    })();

    if save_result.is_err() && temporary.exists() {
        let _ = fs::remove_dir_all(&temporary);
    }
    save_result.map(|_| NativeSaveResult {
        project_dir: target.to_string_lossy().into_owned(),
        video_path: saved_video_path.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn open_project(project_dir: String) -> Result<NativeProject, String> {
    let root = PathBuf::from(project_dir);
    let manifest: Manifest = serde_json::from_slice(
        &fs::read(root.join("manifest.json"))
            .map_err(|_| "This folder does not contain a Game Note manifest.".to_string())?,
    )
    .map_err(|_| "The project manifest is damaged.".to_string())?;
    let annotation_file: AnnotationFile = serde_json::from_slice(
        &fs::read(root.join("annotations.json"))
            .map_err(|_| "This folder does not contain annotations.json.".to_string())?,
    )
    .map_err(|_| "The annotation data is damaged.".to_string())?;
    if manifest.format != "match-video-project"
        || manifest.schema_version != 1
        || annotation_file.schema_version != 1
    {
        return Err("This project version is unsupported.".into());
    }
    let relative_video = Path::new(&manifest.video.path);
    if relative_video.is_absolute()
        || relative_video.components().any(|part| {
            matches!(
                part,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("The project contains an unsafe video path.".into());
    }
    let video = root.join(relative_video);
    let actual_size = fs::metadata(&video)
        .map_err(|_| "The project video is missing.".to_string())?
        .len();
    if actual_size != manifest.video.size {
        return Err("The project video does not match its manifest.".into());
    }
    Ok(NativeProject {
        title: manifest.title,
        project_id: manifest.project_id,
        created_at: manifest.created_at,
        last_playhead_us: manifest.last_playhead_us,
        annotations: annotation_file.annotations,
        organization: annotation_file.organization,
        video_path: video.to_string_lossy().into_owned(),
        project_dir: root.to_string_lossy().into_owned(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let video_source = Arc::new(RwLock::new(None));
    let protocol_source = Arc::clone(&video_source);
    let app = tauri::Builder::default()
        .manage(VideoSource(video_source))
        .manage(DirtyState(AtomicBool::new(false)))
        .plugin(tauri_plugin_dialog::init())
        .register_asynchronous_uri_scheme_protocol("stream", move |_context, request, responder| {
            let response = stream_response(request, &protocol_source).unwrap_or_else(|error| {
                ResponseBuilder::new()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .header(CONTENT_TYPE, "text/plain")
                    .body(error.into_bytes())
                    .expect("valid error response")
            });
            responder.respond(response);
        })
        .invoke_handler(tauri::generate_handler![
            prepare_video,
            set_dirty_state,
            quit_app,
            save_project,
            open_project
        ])
        .build(tauri::generate_context!())
        .expect("error while building Game Note");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            let dirty = app_handle.state::<DirtyState>().0.load(Ordering::SeqCst);
            if dirty {
                api.prevent_exit();
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.emit("game-note://exit-requested", ());
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn streams_requested_video_byte_range() {
        let path = std::env::temp_dir().join(format!(
            "game-note-stream-test-{}-{}.mp4",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::write(&path, b"0123456789").expect("write fixture");
        let source = Arc::new(RwLock::new(Some(path.clone())));
        let request = http::Request::builder()
            .header(RANGE, "bytes=2-5")
            .body(Vec::new())
            .expect("valid request");

        let response = stream_response(request, &source).expect("stream response");
        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.headers()[CONTENT_RANGE], "bytes 2-5/10");
        assert_eq!(response.body(), b"2345");

        fs::remove_file(path).expect("remove fixture");
    }

    #[test]
    fn saves_existing_project_back_to_the_same_folder() {
        let root = std::env::temp_dir().join(format!(
            "game-note-save-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::create_dir_all(&root).expect("create fixture folder");
        let source = root.join("source.mp4");
        fs::write(&source, b"video-one").expect("write source video");

        let first = save_project(
            source.to_string_lossy().into_owned(),
            Some(root.to_string_lossy().into_owned()),
            None,
            "Review".into(),
            "project-1".into(),
            "2026-09-08T00:00:00Z".into(),
            "2026-09-08T00:01:00Z".into(),
            0,
            vec![],
            serde_json::json!({ "rootItems": [], "topics": [] }),
        )
        .expect("first save");

        fs::write(&source, b"video-two").expect("update source video");
        let second = save_project(
            source.to_string_lossy().into_owned(),
            None,
            Some(first.project_dir.clone()),
            "Review".into(),
            "project-1".into(),
            "2026-09-08T00:00:00Z".into(),
            "2026-09-08T00:02:00Z".into(),
            1,
            vec![],
            serde_json::json!({ "rootItems": [], "topics": [] }),
        )
        .expect("overwrite save");

        assert_eq!(second.project_dir, first.project_dir);
        assert_eq!(
            fs::read(second.video_path).expect("read saved video"),
            b"video-two"
        );
        fs::remove_dir_all(root).expect("remove fixture folder");
    }
}
