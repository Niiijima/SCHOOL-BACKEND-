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

/**
 * Fully Automated Class Teacher / Year Tutor Comments based on Overall Terminal Average
 */
const getAutomaticYearTutorComment = (averageScore) => {
    if (averageScore >= 75) return "An exceptionally brilliant performance. Keep maintaining this golden standard.";
    if (averageScore >= 65) return "A highly commendable result. With this consistency, top honors are within reach next term.";
    if (averageScore >= 50) return "A good performance, but you possess the capability to attain higher credit marks.";
    if (averageScore >= 40) return "Passable terminal record. You are playing on the borderline; step up your study habits.";
    return "An unsatisfactory performance. Intensive remedial study and closer supervision are urgently required.";
};

/**
 * Fully Automated Principal / Admin Comments based on Overall Terminal Average
 */
const getAutomaticAdminComment = (averageScore) => {
    if (averageScore >= 75) return "Outstanding academic excellence. A proud reflection of hard work. Keep it up!";
    if (averageScore >= 65) return "Very impressive progress. Promising results showing dedication to studies.";
    if (averageScore >= 50) return "A satisfactory performance. Focus more on weak areas to secure top tiers next session.";
    if (averageScore >= 40) return "Fair trial, but there is vast room for improvement. Double your efforts.";
    return "Unacceptable standard. Must show a completely renewed attitude to work next term to pass.";
};

// Export all pieces cleanly so your controller can destructure them
module.exports = {
    calculateGrade,
    getAutomaticYearTutorComment,
    getAutomaticAdminComment
};