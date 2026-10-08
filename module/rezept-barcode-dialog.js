import { scanneRezeptLokal, pruefeScanDatei, zaehleBarcode } from './rezept-barcode-scan.js?v=20261007m3';
import { uebernehmeRezeptInMaske } from './rezept-in-maske.js?v=20261007m3';
import { entferneBarcodeBestaetigung } from './rezept-barcode-bestaetigung.js?v=20261007m3';

export function initBarcodeDialog(deps) {
  const g=id=>document.getElementById(id);
  if(!g('rezeptScanBtn')) return;
  if(deps.sichtbar()) g('rezeptScanBtn').style.display='';
  let stream=null, controller=null, epoch=0, reading=false, failed=false, handoff=null;
  function error(text) {g('rxScanError').textContent=text;g('rxScanError').style.display='';}
  function chooser() {g('rxScanCamera').style.display='none';g('rxScanProcessing').style.display='none';g('rxScanChooser').style.display='flex';}
  function stopCamera() {stream?.getTracks().forEach(t=>t.stop());stream=null;g('rxScanVideo').srcObject=null;}
  function cancel() {epoch++;controller?.abort();controller=null;reading=false;handoff=null;stopCamera();chooser();}
  async function scan(dataUri, token) {
    const scanController=controller;
    if(token!==epoch || !scanController) return;
    g('rxScanChooser').style.display='none';g('rxScanCamera').style.display='none';g('rxScanProcessing').style.display='';g('rxScanError').style.display='none';
    try {
      const result=await scanneRezeptLokal(dataUri,{signal:scanController.signal});
      if(token!==epoch || scanController.signal.aborted) return;
      zaehleBarcode('barcode_ok');handoff=token;deps.schliessen();
      await uebernehmeRezeptInMaske(result,{oeffneMaske:()=>deps.maske(null),patienten:deps.patienten,
        istAktuell:()=>token===epoch && !scanController.signal.aborted && !g('rezeptModal')?.hidden});
    } catch(e) {
      if(token!==epoch || e.name==='AbortError') return;
      failed=true;chooser();error('Barcode konnte nicht übernommen werden. Bitte das Bild erneut versuchen oder von Hand erfassen.');
    } finally {if(handoff===token) handoff=null;if(token===epoch) reading=false;}
  }
  function begin() {if(reading) return null;reading=true;controller=new AbortController();return ++epoch;}
  g('rezeptScanBtn').addEventListener('click',()=>{cancel();failed=false;g('rxScanError').style.display='none';deps.wahl(null);});
  g('rxScanFileBtn').addEventListener('click',()=>g('rxScanFileInput').click());
  g('rxScanFileInput').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file || reading) return;
    try {pruefeScanDatei(file);} catch(e) {failed=true;error(e.message);return;}
    const token=begin();if(token==null) return;
    const reader=new FileReader();
    const abort=()=>reader.abort();controller.signal.addEventListener('abort',abort,{once:true});
    reader.onload=()=>{controller?.signal.removeEventListener('abort',abort);if(token===epoch) void scan(reader.result,token);};
    reader.onerror=()=>{if(token===epoch){reading=false;failed=true;error('Datei konnte nicht gelesen werden. Bitte von Hand erfassen.');}};
    reader.readAsDataURL(file);
  });
  g('rxScanWebcamBtn').addEventListener('click',async()=>{
    if(reading) return;
    g('rxScanError').style.display='none';
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      error('Kamera benötigt eine sichere Verbindung. Bitte Bild/PDF auswählen oder von Hand erfassen.');return;
    }
    const token=++epoch;
    stopCamera();
    try {
      let captured;
      try {captured=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1920},height:{ideal:1440}}});}
      catch(e) {if(token!==epoch) return;if(!['OverconstrainedError','NotFoundError'].includes(e.name)) throw e;captured=await navigator.mediaDevices.getUserMedia({video:true});}
      if(token!==epoch){captured.getTracks().forEach(t=>t.stop());return;}
      stream=captured;g('rxScanVideo').srcObject=stream;await g('rxScanVideo').play();
      if(token!==epoch) return;
      g('rxScanChooser').style.display='none';g('rxScanCamera').style.display='';
    } catch {if(token!==epoch) return;stopCamera();chooser();error('Kamera nicht verfügbar. Bitte Browserberechtigung prüfen oder Bild/PDF auswählen.');}
  });
  g('rxScanShotBtn').addEventListener('click',()=>{
    const video=g('rxScanVideo');if(!video.videoWidth || !video.videoHeight || reading) return;
    const token=begin();const canvas=g('rxScanCanvas');
    try {
      canvas.width=video.videoWidth;canvas.height=video.videoHeight;
      canvas.getContext('2d').drawImage(video,0,0);const image=canvas.toDataURL('image/png');stopCamera();void scan(image,token);
    } catch {cancel();error('Aufnahme fehlgeschlagen. Bitte Bild/PDF auswählen.');}
    finally {canvas.width=canvas.height=0;}
  });
  g('rxScanCancelCamBtn').addEventListener('click',cancel);
  g('rxScanManuellBtn').addEventListener('click',()=>{if(failed) zaehleBarcode('fallback_manuell');failed=false;cancel();});
  deps.verdrahten(leadId=>deps.maske(leadId));
  document.querySelectorAll('[data-modal="rezeptScanModal"]').forEach(el=>el.addEventListener('click',()=>{cancel();deps.schliessen();}));
  // Generic modal close (Escape/backdrop) also cancels asynchronous acquisition.
  const observer=new MutationObserver(()=>{if(g('rezeptScanModal').hidden && !handoff) cancel();});
  observer.observe(g('rezeptScanModal'),{attributes:true,attributeFilter:['hidden']});
  const recipeModal=g('rezeptModal');
  if(recipeModal) new MutationObserver(()=>{
    if(recipeModal.hidden){cancel();entferneBarcodeBestaetigung();}
  }).observe(recipeModal,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('pagehide',cancel);
}
