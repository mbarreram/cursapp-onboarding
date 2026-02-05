/* ======================================================
   Cursapp · Enrollments (Solicitudes de apoderados)
   ====================================================== */

const ENROLL_KEY = "cursapp_enrollments_v1";

function loadEnrollments() {
  try {
    return JSON.parse(localStorage.getItem(ENROLL_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEnrollments(list) {
  localStorage.setItem(ENROLL_KEY, JSON.stringify(list));
}

function createEnrollment(data) {
  if (!data || !data.email) {
    return { ok: false, error: "Datos incompletos" };
  }

  const enrollments = loadEnrollments();

  const courseKey = (data.courseKey || localStorage.getItem("cursapp_active_course_v1") || "").trim();
  const emailNorm = String(data.email||"").trim().toLowerCase();
  const existingDup = enrollments
    .filter(e => String(e.courseKey||"")===courseKey && String(e.email||"").trim().toLowerCase()===emailNorm)
    .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")))[0];
  if(existingDup){
    // si ya existe, no duplicar
    return { ok: true, enrollment: existingDup, duplicated: true };
  }

  const enrollment = {
    enrollmentId: "enr_" + Date.now(),
    courseKey: (data.courseKey || localStorage.getItem("cursapp_active_course_v1") || "").trim(),
    apoderadoName: data.apoderadoName,
    alumno: data.alumno,
    email: data.email,
    phone: data.phone || "",
    activation: {
      amount: data.activationAmount || 0,
      status: data.activationStatus || "pending"
    },
    status: (data.status || "pending"), // pending por defecto; presidente/apoderado puede forzar approved
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null
  };

  enrollments.push(enrollment);
  saveEnrollments(enrollments);

  return { ok: true, enrollment };
}

function getEnrollmentsByCourse(courseKey) {
  return loadEnrollments().filter(e => e.courseKey === courseKey);
}

function approveEnrollment(id, role) {
  const list = loadEnrollments();
  const e = list.find(x => x.enrollmentId === id);
  if (!e) return false;

  e.status = "approved";
  e.reviewedAt = new Date().toISOString();
  e.reviewedBy = role || "directiva";

  saveEnrollments(list);
  return true;
}

function deleteEnrollment(id) {
  let list = loadEnrollments();
  list = list.filter(e => e.enrollmentId !== id);
  saveEnrollments(list);
  return true;
}