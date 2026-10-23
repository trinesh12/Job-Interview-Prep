const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */

async function generateInterViewReportController(req, res) {
    try {
        // 1. Check required inputs
        const { selfDescription, jobDescription } = req.body;

        if (!jobDescription?.trim()) {
            return res.status(400).json({
                message: "Please provide a job description."
            });
        }

        if (!req.file && !selfDescription?.trim()) {
            return res.status(400).json({
                message: "Please upload a resume or enter a self-description."
            });
        }

        // 2. Extract resume text if a PDF was uploaded
        let resumeText = "";

        if (req.file) {
            const parser = new pdfParse.PDFParse({
                data: Uint8Array.from(req.file.buffer)
            });

            try {
                const resumeContent = await parser.getText();
                resumeText = resumeContent.text || "";
            } finally {
                await parser.destroy();
            }
        }

        // 3. Generate the interview report with Gemini
        const aiReport = await generateInterviewReport({
            resume: resumeText,
            selfDescription: selfDescription || "",
            jobDescription
        });

        // 4. Ensure the title is valid
        const title =
            typeof aiReport.title === "string" &&
            aiReport.title.trim()
                ? aiReport.title.trim()
                : "Job Preparation Plan";

                console.log("AI report before saving:", {
    title: aiReport.title,
    matchScore: aiReport.matchScore,
    technicalQuestions: aiReport.technicalQuestions?.length,
    behavioralQuestions: aiReport.behavioralQuestions?.length,
    skillGaps: aiReport.skillGaps?.length,
    preparationPlan: aiReport.preparationPlan?.length
});

        // 5. Save the report to MongoDB
        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeText,
            selfDescription: selfDescription || "",
            jobDescription,
            ...aiReport,
            title
        });

        return res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        });
    } catch (error) {
        console.error("Generate interview report error:", error);

        return res.status(500).json({
            message: "Failed to generate interview report.",
            error: error.message
        });
    }
}


/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findById(interviewReportId)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}

module.exports = { generateInterViewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController }