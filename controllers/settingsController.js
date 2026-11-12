const Settings = require('../models/Settings');
const TermStatus = require('../models/TermStatus');

exports.getCurrentYear = async (req, res) => {
    try {
        // Prefer Settings document if you store current year there
        let settings = await Settings.findOne();

        // Fallback: get from the latest TermStatus
        if (!settings || !settings.currentAcademicYear) {
            const latestTerm = await TermStatus.findOne().sort({ createdAt: -1 });
            return res.status(200).json({
                academicYear: latestTerm?.academicYear || '2025/2026',
                currentTerm: latestTerm?.currentTerm || 'First Term',
                isLocked: latestTerm?.isLocked || false
            });
        }

        res.status(200).json({
            academicYear: settings.currentAcademicYear,
            currentTerm: settings.currentTerm || 'First Term',
            isLocked: settings.isLocked || false
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};