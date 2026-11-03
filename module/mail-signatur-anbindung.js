import { mountMailSignaturen } from './mail-signatur-editor.js';
import { ladePraxisLogoHoch, logoDateiAlsPng } from './praxis-logo-upload.js?v=20261103mail1';
export function verbindeMailSignaturen({supabase,getProfil,getUserId,showToast}) {
  return mountMailSignaturen({config:document.getElementById('mailSignaturEditor'),compose:document.getElementById('mailSignaturCompose'),getProfil,isOwner:()=>getProfil()?.role==='owner',showToast,
    async speichern(settings){
      const p=getProfil(),id=getUserId();if(p?.role!=='owner'||p.id!==id)throw new Error('OWNER_REQUIRED');
      const {data,error}=await supabase.from('profiles').update({mail_signatur_einstellungen:settings}).eq('id',id).select('id').single();
      if(error||data?.id!==id)throw new Error('SAVE_FAILED');p.mail_signatur_einstellungen=settings;
    },
    async uploadLogo(file){if(getProfil()?.role!=='owner')throw new Error('Nur der Praxisinhaber darf Logos hochladen.');return ladePraxisLogoHoch(supabase,getUserId(),await logoDateiAlsPng(file));}
  });
}
