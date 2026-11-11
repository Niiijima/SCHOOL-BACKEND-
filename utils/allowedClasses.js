const ALLOWED_CLASSES = [
  "JSS1",
  "JSS2",
  "JSS3",
  "SS1",
  "SS2",
  "SS3",
];

const DEPARTMENTS = ["Science", "Art", "Commercial"];

const SENIOR_CLASSES = ["SS1", "SS2", "SS3"];
const JUNIOR_CLASSES = ["JSS1", "JSS2", "JSS3"];

function isSeniorClass(className = "") {
  const cls = String(className).trim().toUpperCase();
  return SENIOR_CLASSES.includes(cls);
}

function isJuniorClass(className = "") {
  const cls = String(className).trim().toUpperCase();
  return JUNIOR_CLASSES.includes(cls);
}

/**
 * Validates class + department combination
 * - Junior (JSS1–JSS3): no department allowed
 * - Senior (SS1–SS3): department is required
 */
function validateClassAndDepartment(currentClass, department) {
  const cls = String(currentClass || "").trim().toUpperCase();
  const dept = department ? String(department).trim() : null;

  if (!ALLOWED_CLASSES.includes(cls)) {
    return {
      valid: false,
      message: `Class must be one of: ${ALLOWED_CLASSES.join(", ")}`,
    };
  }

  if (isSeniorClass(cls)) {
    if (!dept || !DEPARTMENTS.includes(dept)) {
      return {
        valid: false,
        message: `Senior classes require a department: ${DEPARTMENTS.join(", ")}`,
      };
    }
  } else {
    // Junior – department must be null/empty
    if (dept) {
      return {
        valid: false,
        message: "Junior classes (JSS1–JSS3) must not have a department",
      };
    }
  }

  return { valid: true, class: cls, department: isSeniorClass(cls) ? dept : null };
}

function formatClassDisplay(currentClass, department) {
  if (!currentClass) return "—";
  if (department) return `${currentClass} ${department}`;
  return currentClass;
}

module.exports = {
  ALLOWED_CLASSES,
  DEPARTMENTS,
  SENIOR_CLASSES,
  JUNIOR_CLASSES,
  isSeniorClass,
  isJuniorClass,
  validateClassAndDepartment,
  formatClassDisplay,
};