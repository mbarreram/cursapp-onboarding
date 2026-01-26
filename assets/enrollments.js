/* =========================================
   Cursapp · enrollments.js (v1)
   - Solicitudes de apoderados por curso
   - Aprobación obligatoria (A)
   ========================================= */

const KEY_COURSE = "cursapp_course_v1";
const KEY_ENROLL = "cursapp_enrollments_v1";

function loadCourseV1(){
  try { return JSON.parse(localStorage.getItem(KEY_COURSE) || "null"); } catch(e){ return null; }
}
function saveCourseV1(c){
  localStorage.setItem(KEY_COURSE, JSON.stringify(c));
}

function loadEnrollments(){
  try { return JSON.parse(localStorage.getItem(KEY_ENROLL) || "[]"); } catch(e){ return []; }
}
function saveEnrollments(list){
  localStorage.setItem(KEY_ENROLL, JSON.stringify(list || []));
}

function uidEnr(){
  return "enr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
}

function makeInviteCode(){
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for(let i=0;i<6;i++) s += alphabet[Math.floor(Math.random()*alphabet.length)];
  return s;
}

function ensureCourseInvite(){
  const c = loadCourseV1();
  if(!c) return null;
  if(!c.inviteCode){
    c.inviteCode = makeInviteCode();
    saveCourseV1(c);
  }
  return c;
}

function createEnrollment(payload){
  const course = loadCourseV1();
  if(!course){
    return { ok:false, error:"No existe curso activo." };
  }

  const list = loadEnrollments();

  // evita duplicado por alumno + curso
  const dupe = list.find(e =>
    e.courseKey === course.courseKey &&
    String(e.alumno||"").toLowerCase() === String(payload.alumno||"").toLowerCase() &&
    e.status !== "deleted"
  );
  if(dupe){
    return { ok:false, error:"Ya existe una solicitud para ese alumno en este curso." };
  }

  const enr = {
    enrollmentId: uidEnr(),
    courseKey: course.courseKey,
    inviteCode: course.inviteCode || null,

    apoderadoName: payload.apoderadoName || "",
    alumno: payload.alumno || "",
    email: payload.email || "",
    phone: payload.phone || "",

    activation: {
      amount: payload.activationAmount || 7990,
      status: payload.activationStatus || "pending", // paid|pending
      paidAt: payload.activationStatus === "paid" ? new Date().toISOString() : null
    },

    status: "pending", // pending|approved|rejected|deleted
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: ""
  };

  list.unshift(enr);
  saveEnrollments(list);
  return { ok:true, enrollment: enr };
}

function approveEnrollment(enrollmentId, reviewerRole){
  const list = loadEnrollments();
  const idx = list.findIndex(e => e.enrollmentId === enrollmentId);
  if(idx < 0) return { ok:false, error:"No encontrado." };

  list[idx].status = "approved";
  list[idx].reviewedAt = new Date().toISOString();
  list[idx].reviewedBy = reviewerRole || "directiva";
  list[idx].reviewNote = "";
  saveEnrollments(list);

  return { ok:true };
}

function deleteEnrollment(enrollmentId, reviewerRole, note){
  const list = loadEnrollments();
  const idx = list.findIndex(e => e.enrollmentId === enrollmentId);
  if(idx < 0) return { ok:false, error:"No encontrado." };

  list[idx].status = "deleted";
  list[idx].reviewedAt = new Date().toISOString();
  list[idx].reviewedBy = reviewerRole || "directiva";
  list[idx].reviewNote = note || "Eliminado por directiva";
  saveEnrollments(list);

  return { ok:true };
}

function courseEnrollments(courseKey){
  return loadEnrollments().filter(e => e.courseKey === courseKey && e.status !== "deleted");
}

function pendingEnrollments(courseKey){
  return loadEnrollments().filter(e => e.courseKey === courseKey && e.status === "pending");
}

function enrollmentStatusForEmail(email){
  const c = loadCourseV1();
  if(!c) return null;
  const list = loadEnrollments();
  const found = list.find(e => e.courseKey === c.courseKey && String(e.email||"").toLowerCase() === String(email||"").toLowerCase() && e.status !== "deleted");
  return found || null;
}
