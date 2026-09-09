'use client';

import { Building2, Globe2, Info, Mail } from 'lucide-react';
import companyInfo from '@/company-info.json';
import packageInfo from '@/package.json';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
}

export function AboutDialog() {
  return <Dialog>
    <DialogTrigger render={<Button className="about-trigger" variant="ghost" size="sm" />}><Info />About</DialogTrigger>
    <DialogContent className="about-dialog">
      <DialogHeader><DialogTitle>About Game Note</DialogTitle><DialogDescription>Version {packageInfo.version}</DialogDescription></DialogHeader>
      <div className="about-company"><span className="about-company-icon"><Building2 /></span><div><strong>{companyInfo.companyName}</strong><span>{companyInfo.legalName}</span></div></div>
      <p>{companyInfo.copyright}</p>
      <div className="about-links">
        <ExternalLink href={companyInfo.website}><Globe2 />Website</ExternalLink>
        <ExternalLink href={`mailto:${companyInfo.supportEmail}`}><Mail />{companyInfo.supportEmail}</ExternalLink>
        <ExternalLink href={companyInfo.supportUrl}>Support</ExternalLink>
        <ExternalLink href={companyInfo.privacyPolicyUrl}>Privacy Policy</ExternalLink>
        <ExternalLink href={companyInfo.termsOfUseUrl}>Terms of Use</ExternalLink>
      </div>
      {companyInfo.address && <p>{companyInfo.address}</p>}
      <div className="about-legal"><span>License: {companyInfo.license}</span>{companyInfo.trademarkNotice && <span>{companyInfo.trademarkNotice}</span>}</div>
    </DialogContent>
  </Dialog>;
}
