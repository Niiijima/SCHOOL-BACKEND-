/**
 * Calculates total score, letter grade, and remark based on section and breakdown.
 */
const calculateGrade = (section, test1 = 0, test2 = 0, test3 = 0, assignment = 0, exam = 0) => {
    const totalScore = Number(test1) + Number(test2) + Number(test3) + Number(assignment) + Number(exam);
    const standardSection = section ? section.toUpperCase() : 'JSS';

    if (standardSection === 'SSS') {
        // SSS / WAEC 9-Point System
        if (totalScore >= 75) return { totalScore, grade: 'A1', remark: 'Excellent' };
        if (totalScore >= 70) return { totalScore, grade: 'B2', remark: 'Very Good' };
        if (totalScore >= 65) return { totalScore, grade: 'B3', remark: 'Good' };
        if (totalScore >= 60) return { totalScore, grade: 'C4', remark: 'Credit' };
        if (totalScore >= 55) return { totalScore, grade: 'C5', remark: 'Credit' };
        if (totalScore >= 50) return { totalScore, grade: 'C6', remark: 'Credit' };
        if (totalScore >= 45) return { totalScore, grade: 'D7', remark: 'Pass' };
        if (totalScore >= 40) return { totalScore, grade: 'E8', remark: 'Fair' };
        return { totalScore, grade: 'F9', remark: 'Fail' };
    } else {
        // JSS 4-Point System
        if (totalScore >= 70) return { totalScore, grade: 'A', remark: 'Distinction' };
        if (totalScore >= 60) return { totalScore, grade: 'B', remark: 'Upper Credit' };
        if (totalScore >= 50) return { totalScore, grade: 'C', remark: 'Lower Credit' };
        if (totalScore >= 40) return { totalScore, grade: 'P', remark: 'Pass' };
        return { totalScore, grade: 'F', remark: 'Fail' };
    }
};

module.exports = calculateGrade;