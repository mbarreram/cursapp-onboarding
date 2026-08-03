(function(){
  'use strict';
  if(window.__MICURSOX_FINAL_SUMMARY_FIX__) return;
  window.__MICURSOX_FINAL_SUMMARY_FIX__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';

  function readDraft(){
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function cleanText(value){
    return String(value || '').trim();
  }

  function findSummaryRow(label){
    return Array.from(document.querySelectorAll('.onbSummaryRows > div')).find(row => {
      const caption = row.querySelector('span');
      return cleanText(caption?.textContent).toLowerCase() === label.toLowerCase();
    }) || null;
  }

  function resolveSchoolName(draft){
    const fromDraft = cleanText(draft.schoolName || draft.colegioNombre || draft.school || draft.colegio);
    if(fromDraft) return fromDraft;

    const selected = document.getElementById('onbSchool');
    const selectedText = cleanText(selected?.selectedOptions?.[0]?.textContent);
    if(selectedText && !/^selecciona/i.test(selectedText)) return selectedText;

    const visibleCard = document.querySelector('.onbSchoolSelectedName');
    return cleanText(visibleCard?.textContent);
  }

  function patchSummary(){
    const summary = document.querySelector('.onbSummaryRows');
    if(!summary) return;

    const draft = readDraft();
    const schoolName = resolveSchoolName(draft);
    const schoolRow = findSummaryRow('Colegio');
    const schoolValue = schoolRow?.querySelector('b');
    if(schoolValue && schoolName && cleanText(schoolValue.textContent) !== schoolName){
      schoolValue.textContent = schoolName;
    }

    const regionRow = findSummaryRow('Región');
    const regionValue = regionRow?.querySelector('b');
    const regionName = cleanText(draft.regionName);
    if(regionValue && regionName && cleanText(regionValue.textContent) !== regionName){
      regionValue.textContent = regionName;
    }

    const comunaRow = findSummaryRow('Comuna');
    const comunaValue = comunaRow?.querySelector('b');
    const comunaName = cleanText(draft.comunaName);
    if(comunaValue && comunaName && cleanText(comunaValue.textContent) !== comunaName){
      comunaValue.textContent = comunaName;
    }
  }

  function patchSuccessIcon(){
    const icon = document.querySelector('.onbSuccessHero .onbSuccessIcon');
    if(!icon || icon.classList.contains('onbSuccessIcon--clear')) return;

    icon.classList.add('onbSuccessIcon--clear');
    icon.innerHTML = `
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path d="M8 28 32 14l24 14-24 14L8 28Z" fill="currentColor" opacity=".18"/>
        <path d="M13 28 32 17l19 11-19 11-19-11Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
        <path d="M18 34v13h28V34M24 47V37h16v10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M51 29v12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      </svg>
      <span class="onbSuccessIconCheck" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="m5 12.5 4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>`;
  }

  function apply(){
    patchSummary();
    patchSuccessIcon();
  }

  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 30);
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }

  const app = document.getElementById('app') || document.body;
  const observer = new MutationObserver(schedule);
  observer.observe(app, { childList: true, subtree: true });
})();
