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

  const enrollment = {
    enrollmentId: "enr_" + Date.now(),
    courseKey: data.courseKey || localStorage.getItem("cursapp_active_course_v1"),
    apoderadoName: data.apoderadoName,
    alumno: data.alumno,
    email: data.email,
    phone: data.phone || "",
    activation: {
      amount: data.activationAmount || 0,
      status: data.activationStatus || "pending"
    },
    status: data.status || "pending",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null
  };

  
// Evitar duplicados por correo+curso
const dup = enrollments.find(x =>
  String(x.email||"").toLowerCase() === String(enrollment.email||"").toLowerCase() &&
  String(x.courseKey||"") === String(enrollment.courseKey||"")
);
if (dup) {
  return { ok: false, error: "Este correo ya tiene una solicitud/registro en este curso." };
}

// Si viene aprobado desde un flujo especial (Presidente+Apoderado)
if (enrollment.status === "approved") {
  enrollment.reviewedAt = new Date().toISOString();
  enrollment.reviewedBy = data.reviewedBy || "presidente";
}
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
