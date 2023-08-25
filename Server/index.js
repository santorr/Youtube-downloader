const { execSync } = require('child_process');
const path = require('path');

// Check if required dependencies are installed
try {
    require('express');
    require('ytdl-core');
    require('fs').promises;
    require('fluent-ffmpeg');
} catch (err) {
    console.log('Required dependencies are not installed. Installing...');

    try {
        // Install the required dependencies
        execSync('npm install express ytdl-core fluent-ffmpeg', { stdio: 'inherit' });

        console.log('Dependencies installed successfully.');
    } catch (error) {
        console.error('Error installing dependencies:', error);
        process.exit(1); // Exit the script with an error code
    }
}

// Import required modules
const express = require('express');
const ytdl = require('ytdl-core');
const fs = require('fs').promises;
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');

// Configuration
const app = express();
const formatVideo = 'mp4';
const formatAudio = 'mp3';
const destinationPath = path.join(__dirname, '..', 'Videos');
const extensionID = 'bpmlhgfegmekfekenjmjipebcmckcpol';

app.use(express.json());

// Configure CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', `chrome-extension://${extensionID}`);
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.listen(4000, () => {
    console.log('Server is running on port 4000...');
});

/**
 * Cleans a string by removing special characters and replacing spaces with underscores.
 * @param {string} inputString - The input string to be cleaned.
 * @returns {string} - The cleaned string.
 */
function cleanString(inputString) {
    const cleanedString = inputString.replace(/[^\w\s]/gi, "");
    const stringWithUnderscores = cleanedString.replace(/\s+/g, "_");
    return stringWithUnderscores;
}

/**
 * Downloads the video and audio streams from YouTube.
 * @param {object} info - Information about the video.
 * @param {string} formatVideo - The desired video format.
 * @param {string} formatAudio - The desired audio format.
 * @returns {object} - Object containing video info and temporary file paths.
 */
async function downloadMedia(info, formatVideo, formatAudio) {
    const tempVideoFile = path.join(destinationPath, `${info.clean_video_title}_video.${formatVideo}`);
    const tempAudioFile = path.join(destinationPath, `${info.clean_video_title}_audio.${formatAudio}`);

    const videoStream = ytdl(info.url, { quality: 'highestvideo' });
    const audioStream = ytdl(info.url, { quality: 'highestaudio' });

    await Promise.all([
        fs.writeFile(tempVideoFile, await videoStream),
        fs.writeFile(tempAudioFile, await audioStream)
    ]);

    return { info, tempVideoFile, tempAudioFile };
}

/**
 * Merges the downloaded video and audio files.
 * @param {object} info - Information about the video.
 * @param {string} tempVideoFile - Path to the temporary video file.
 * @param {string} tempAudioFile - Path to the temporary audio file.
 * @returns {string} - Path to the merged media file.
 */
async function mergeMedia(info, tempVideoFile, tempAudioFile) {
    const mergedFile = path.join(destinationPath, info.category, `${info.clean_video_title}.mp4`);

    const outputDirectory = path.dirname(mergedFile);
    try {
        await fs.access(outputDirectory, fs.constants.F_OK);
    } catch (err) {
        await fs.mkdir(outputDirectory, { recursive: true });
    }

    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(tempVideoFile)
            .input(tempAudioFile)
            .outputOptions([
                '-c:v copy',
                '-c:a copy',
            ])
            .output(mergedFile)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });

    console.log('Video and audio merged.');

    return mergedFile;
}

/**
 * Handles the download route for YouTube videos.
 */
app.post('/download', async (req, res) => {
    const link = req.body.url;

    try {
        const videoInfo = await ytdl.getBasicInfo(link).then(info => info.videoDetails);

        const info = {
            'url': videoInfo.video_url,
            'video_id': videoInfo.videoId,
            'video_title': videoInfo.title,
            'clean_video_title': cleanString(videoInfo.title),
            'channel_id': videoInfo.channelId,
            'channel_name': videoInfo.ownerChannelName,
            'category': videoInfo.category,
        };

        console.log('Preparing for download:', info);

        const { tempVideoFile, tempAudioFile } = await downloadMedia(info, formatVideo, formatAudio);
        console.log('Video and audio downloaded.');

        const mergedFile = await mergeMedia(info, tempVideoFile, tempAudioFile);

        await Promise.all([
            fs.unlink(tempVideoFile),
            fs.unlink(tempAudioFile)
        ]);

        console.log('Temporary files deleted.');

        exec(`start ${mergedFile}`);

        res.send('Download and merge completed successfully.');
    } catch (error) {
        console.error('Process error:', error);
        res.status(500).send('An error occurred during the process.');
    }
});