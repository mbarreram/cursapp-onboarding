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

  // Permite crear enrollments aprobados en casos especiales (ej: Presidente que también es Apoderado).
  // Mantiene el comportamiento histórico: por defecto siempre queda "pending".
  const forcedStatus = (data && data.status) ? String(data.status) : "pending";
  const reviewedBy = (data && data.reviewedBy) ? String(data.reviewedBy) : null;
  const reviewedAt = (data && data.reviewedAt) ? String(data.reviewedAt) : null;

  const enrollment = {
    enrollmentId: "enr_" + Date.now(),
    courseKey: localStorage.getItem("cursapp_active_course_v1"),
    apoderadoName: data.apoderadoName,
    alumno: data.alumno,
    email: data.email,
    phone: data.phone || "",
    activation: {
      amount: data.activationAmount || 0,
      status: data.activationStatus || "pending"
    },
    // Por defecto queda pendiente. En casos especiales puede forzarse a "approved".
    status: (forcedStatus === "approved" ? "approved" : "pending"),
    createdAt: new Date().toISOString(),
    reviewedAt: (forcedStatus === "approved" ? (reviewedAt || new Date().toISOString()) : null),
    reviewedBy: (forcedStatus === "approved" ? (reviewedBy || "directiva") : null)
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
