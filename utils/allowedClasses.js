
const ALLOWED_CLASSES = [
    'JSS1',
    'JSS2',
    'JSS3',
    'SS1',
    'SS2',
    'SS3'
];

const DEPARTMENTS = [
    'Science',
    'Arts',
    'Commercial'
];

// Used for grading and academic section determination.
// SS1 must remain a senior class.
const SENIOR_CLASSES = ['SS1', 'SS2', 'SS3'];

const JUNIOR_CLASSES = ['JSS1', 'JSS2', 'JSS3'];

// Only SS2 and SS3 require departments.
const DEPARTMENT_CLASSES = ['SS2', 'SS3'];

function isSeniorClass(className = '') {
    const cls = String(className).trim().toUpperCase();
    return SENIOR_CLASSES.includes(cls);
}

function isJuniorClass(className = '') {
    const cls = String(className).trim().toUpperCase();
    return JUNIOR_CLASSES.includes(cls);
}

function requiresDepartment(className = '') {
    const cls = String(className).trim().toUpperCase();
    return DEPARTMENT_CLASSES.includes(cls);
}

/**
 * Validates class and department combinations.
 *
 * JSS1-JSS3: No department.
 * SS1: No department.
 * SS2-SS3: Department required.
 */
function validateClassAndDepartment(currentClass, department) {
    const cls = String(currentClass || '').trim().toUpperCase();

    let dept = department
        ? String(department).trim()
        : null;

    // Normalize department spelling.
    if (dept) {
        const normalized = DEPARTMENTS.find(
            item => item.toLowerCase() === dept.toLowerCase()
        );

        if (normalized) {
            dept = normalized;
        } else if (dept.toLowerCase() === 'art') {
            dept = 'Arts';
        }
    }

    if (!ALLOWED_CLASSES.includes(cls)) {
        return {
            valid: false,
            message: `Class must be one of: ${ALLOWED_CLASSES.join(', ')}`
        };
    }

    if (requiresDepartment(cls)) {
        if (!dept || !DEPARTMENTS.includes(dept)) {
            return {
                valid: false,
                message: `${cls} requires a valid department: ${DEPARTMENTS.join(', ')}`
            };
        }
    } else {
        if (dept) {
            return {
                valid: false,
                message: `${cls} must not have a department.`
            };
        }

        dept = null;
    }

    return {
        valid: true,
        class: cls,
        department: requiresDepartment(cls) ? dept : null
    };
}

function formatClassDisplay(currentClass, department) {
    if (!currentClass) return '—';

    const cls = String(currentClass).trim().toUpperCase();

    if (requiresDepartment(cls) && department) {
        return `${cls} ${department}`;
    }

    return cls;
}

module.exports = {
    ALLOWED_CLASSES,
    DEPARTMENTS,
    SENIOR_CLASSES,
    JUNIOR_CLASSES,
    DEPARTMENT_CLASSES,
    isSeniorClass,
    isJuniorClass,
    requiresDepartment,
    validateClassAndDepartment,
    formatClassDisplay
};
