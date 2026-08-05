import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { R2_BUCKET_NAME, r2Client } from "../config/r2.js";

async function testR2Connection() {
    try {
        const result = await r2Client.send(
            new ListObjectsV2Command({
                Bucket: R2_BUCKET_NAME,
                MaxKeys: 1,
            }),
        );

        console.log("R2 connection successful.");
        console.log(`Bucket: ${R2_BUCKET_NAME}`);
        console.log(`Objects currently stored: ${result.KeyCount ?? 0}`);
    } catch (error) {
        console.error("R2 connection failed.");

        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error(String(error));
        }

        process.exitCode = 1;
    } finally {
        r2Client.destroy();
    }
}

void testR2Connection();
