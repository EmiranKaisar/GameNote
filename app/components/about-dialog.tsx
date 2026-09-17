'use client';

import { Building2, Code2, FileText, Info, Mail, Scale, ScrollText } from 'lucide-react';
import companyInfo from '@/company-info.json';
import packageInfo from '@/package.json';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
}

const repositoryUrl = 'https://github.com/EmiranKaisar/MatchVideoPlayer';
const legalDocumentUrl = (fileName: string) => `${repositoryUrl}/blob/master/${fileName}`;

export function AboutDialog() {
  return <Dialog>
    <DialogTrigger render={<Button className="about-trigger" variant="ghost" size="sm" />}><Info />About</DialogTrigger>
    <DialogContent className="about-dialog">
      <DialogHeader><DialogTitle>About Game Note</DialogTitle><DialogDescription>Version {packageInfo.version}</DialogDescription></DialogHeader>
      <div className="about-company"><span className="about-company-icon"><Building2 /></span><div><strong>{companyInfo.companyName}</strong><span>{companyInfo.legalName}</span></div></div>
      <div className="about-links">
        <ExternalLink href={`mailto:${companyInfo.supportEmail}`}><Mail />{companyInfo.supportEmail}</ExternalLink>
        <ExternalLink href={repositoryUrl}><Code2 />Source Code</ExternalLink>
        <ExternalLink href={legalDocumentUrl('LICENSE')}><Scale />MIT License</ExternalLink>
        <ExternalLink href={legalDocumentUrl('PRIVACY.md')}><FileText />Privacy Policy</ExternalLink>
        <ExternalLink href={legalDocumentUrl('THIRD_PARTY_NOTICES.md')}><ScrollText />Third-Party Notices</ExternalLink>
      </div>
      <div className="about-legal">
        <span>Copyright © 2026 {companyInfo.legalName}</span>
        <span>Licensed under the {companyInfo.license}.</span>
      </div>
    </DialogContent>
  </Dialog>;
}
