import {
    createResumeDownloadUrl,
    createResumeFileKey,
    deleteResumeObject,
    uploadResumeObject,
} from "../modules/resume/resume-storage.service.js";
import { r2Client } from "../config/r2.js";

async function testResumeStorage() {
    const fileKey = createResumeFileKey({
        userId: "storage-test",
        originalName: "jobs-spot-storage-test.pdf",
    });

    const fileBuffer = Buffer.from("%PDF-1.4\n% JobsSpot temporary R2 storage test\n", "utf8");

    let wasUploaded = false;

    try {
        await uploadResumeObject({
            fileKey,
            fileBuffer,
            mimeType: "application/pdf",
        });

        wasUploaded = true;

        console.log("Temporary resume object uploaded.");

        const downloadUrl = await createResumeDownloadUrl({
            fileKey,
            expiresInSeconds: 60,
        });

        const response = await fetch(downloadUrl);

        if (!response.ok) {
            throw new Error(`Signed download returned HTTP ${response.status}.`);
        }

        const downloadedBuffer = Buffer.from(await response.arrayBuffer());

        if (!downloadedBuffer.equals(fileBuffer)) {
            throw new Error("Downloaded object does not match the uploaded object.");
        }

        console.log("Signed resume download verified.");
    } finally {
        if (wasUploaded) {
            await deleteResumeObject(fileKey);

            console.log("Temporary resume object deleted.");
        }

        r2Client.destroy();
    }
}

testResumeStorage()
    .then(() => {
        console.log("R2 resume storage round-trip successful.");
    })
    .catch((error) => {
        console.error("R2 resume storage round-trip failed.");

        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error(String(error));
        }

        process.exitCode = 1;
    });
