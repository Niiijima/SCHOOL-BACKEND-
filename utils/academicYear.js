
const Settings = require('../models/Settings');

exports.getCurrentAcademicYear = async () => {
    let settings = await Settings.findOne();

    if (!settings) {
        settings = await Settings.create({
            currentAcademicYear: "2026/2027"
        });
    }

    return settings.currentAcademicYear;
};

exports.advanceAcademicYear = async (currentYear) => {
    // Example: 2025/2026 -> 2026/2027
    const [start, end] = currentYear.split('/');

    const nextYear = `${Number(start) + 1}/${Number(end) + 1}`;

    const settings = await Settings.findOneAndUpdate(
        {},
        { currentAcademicYear: nextYear },
        { upsert: true, new: true }
    );

    return settings.currentAcademicYear;
};
