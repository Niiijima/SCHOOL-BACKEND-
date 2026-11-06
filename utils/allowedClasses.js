// utils/allowedClasses.js

const JUNIOR_CLASSES = ['JSS1', 'JSS2', 'JSS3'];
const SENIOR_CLASSES = ['SS1', 'SS2', 'SS3'];
const DEPARTMENTS = ['Science', 'Art', 'Commercial'];

const ALLOWED_CLASSES = [...JUNIOR_CLASSES, ...SENIOR_CLASSES];

/**
 * Validate class + department combination
 * @param {string} currentClass - e.g. "JSS1" or "SS2"
 * @param {string|null} department - "Science" | "Art" | "Commercial" | null
 * @returns {{ valid: boolean, message?: string }}
 */
function validateClassAndDepartment(currentClass, department = null) {
    if (!currentClass || !ALLOWED_CLASSES.includes(currentClass)) {
        return {
            valid: false,
            message: `Invalid class. Allowed classes: ${ALLOWED_CLASSES.join(', ')}`
        };
    }

    const isSenior = SENIOR_CLASSES.includes(currentClass);

    if (isSenior) {
        if (!department || !DEPARTMENTS.includes(department)) {
            return {
                valid: false,
                message: `Senior classes (SS1–SS3) require a department. Allowed: ${DEPARTMENTS.join(', ')}`
            };
        }
    } else {
        // Junior classes should not have a department
        if (department) {
            return {
                valid: false,
                message: 'Junior classes (JSS1–JSS3) should not have a department'
            };
        }
    }

    return { valid: true };
}

/**
 * Returns a nice display string
 * e.g. "SS2 Science" or "JSS1"
 */
function formatClassDisplay(currentClass, department = null) {
    if (department && SENIOR_CLASSES.includes(currentClass)) {
        return `${currentClass} ${department}`;
    }
    return currentClass;
}

module.exports = {
    JUNIOR_CLASSES,
    SENIOR_CLASSES,
    DEPARTMENTS,
    ALLOWED_CLASSES,
    validateClassAndDepartment,
    formatClassDisplay
};