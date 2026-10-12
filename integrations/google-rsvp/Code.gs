const RSVP_HEADERS = ['접수 시간', '구분', '성함', '참석 여부', '본인 포함 인원', '식사 여부', '메시지', '수집 이용 동의', '접수 ID'];

// 구글 시트의 확장 프로그램 > Apps Script에서 이 함수를 최초 1회 실행합니다.
function setupRsvp() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('응답을 저장할 시트에서 Apps Script를 열어 주세요.');
  PropertiesService.getScriptProperties().setProperty('RSVP_SPREADSHEET_ID', book.getId());
  const sheet = book.getSheetByName('참석 응답') || book.insertSheet('참석 응답');
  if (sheet.getLastRow() === 0) sheet.appendRow(RSVP_HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.getRange('C:C').setNumberFormat('@');
  sheet.getRange('G:I').setNumberFormat('@');
}

function rsvpJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function validateRsvp_(p) {
  const name = String(p.name || '').trim();
  const message = String(p.message || '').trim();
  const attending = p.attendance === '참석';
  const guests = attending ? Number(p.guests) : 0;
  if (p.website || p.consent !== 'on' || !/^[a-zA-Z0-9-]{16,64}$/.test(p.submissionId || '') ||
      !['신랑측', '신부측'].includes(p.side) || !['참석', '불참'].includes(p.attendance) ||
      !name || name.length > 40 || message.length > 500 ||
      (attending && (!Number.isInteger(guests) || guests < 1 || guests > 20 || !['식사 예정', '식사 안 함', '미정'].includes(p.meal)))) {
    throw new Error('INVALID_INPUT');
  }
  // 사용자 입력이 시트 수식으로 실행되지 않도록 텍스트로 저장합니다.
  const asText = value => /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
  return [new Date(), p.side, asText(name), p.attendance, guests, attending ? p.meal : '해당 없음', asText(message), '동의', p.submissionId];
}

function doPost(e) {
  let lock;
  try {
    if (!e || e.contentLength > 12000) throw new Error('INVALID_INPUT');
    const p = e.parameter || {};
    const row = validateRsvp_(p);
    const id = PropertiesService.getScriptProperties().getProperty('RSVP_SPREADSHEET_ID');
    if (!id) throw new Error('NOT_CONFIGURED');
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.openById(id).getSheetByName('참석 응답');
    if (!sheet) throw new Error('NOT_CONFIGURED');
    const last = sheet.getLastRow();
    // 응답이 저장된 뒤 네트워크가 끊겨 재전송돼도 같은 행을 중복 추가하지 않습니다.
    const exists = last > 1 && sheet.getRange(2, 9, last - 1, 1).createTextFinder(p.submissionId).matchEntireCell(true).findNext();
    if (!exists) {
      sheet.appendRow(row);
      SpreadsheetApp.flush();
    }
    return rsvpJson_({ ok: true, submissionId: p.submissionId });
  } catch (error) {
    return rsvpJson_({ ok: false, code: error.message === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'SAVE_FAILED' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

// 응답 데이터나 시트 ID를 외부에 반환하지 않습니다.
function doGet() {
  return rsvpJson_({ service: 'wedding-rsvp', ready: Boolean(PropertiesService.getScriptProperties().getProperty('RSVP_SPREADSHEET_ID')) });
}
