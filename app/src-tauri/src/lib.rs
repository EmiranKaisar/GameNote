use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

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
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeProject {
    title: String,
    project_id: String,
    created_at: String,
    last_playhead_us: u64,
    annotations: Vec<Value>,
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
fn save_project(
    source_video_path: String,
    destination_dir: String,
    title: String,
    project_id: String,
    created_at: String,
    updated_at: String,
    last_playhead_us: u64,
    annotations: Vec<Value>,
) -> Result<String, String> {
    let source = PathBuf::from(&source_video_path);
    if !source.is_file() {
        return Err("The selected source video no longer exists.".into());
    }
    let destination = PathBuf::from(destination_dir);
    if !destination.is_dir() {
        return Err("Choose an existing destination folder.".into());
    }

    let video_name = safe_name(
        source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("match-video"),
    );
    let project_name = format!("{}.matchproject", safe_name(&title));
    let target = destination.join(project_name);
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary = destination.join(format!(".touchline-{stamp}.tmp"));
    let backup = destination.join(format!(".touchline-{stamp}.backup"));

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
                original_filename: video_name,
                size: video_size,
                r#type: media_type(&source).into(),
            },
            annotations_path: "annotations.json".into(),
            last_playhead_us,
        };
        let annotation_file = AnnotationFile {
            schema_version: 1,
            annotations,
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
    save_result.map(|_| target.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_project(project_dir: String) -> Result<NativeProject, String> {
    let root = PathBuf::from(project_dir);
    let manifest: Manifest = serde_json::from_slice(
        &fs::read(root.join("manifest.json"))
            .map_err(|_| "This folder does not contain a Touchline manifest.".to_string())?,
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
        video_path: video.to_string_lossy().into_owned(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_project, open_project])
        .run(tauri::generate_context!())
        .expect("error while running Touchline");
}
