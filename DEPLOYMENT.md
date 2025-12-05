# Deployment Guide for SoundScape

This project is ready to be deployed to Vercel. Because the web application lives in the `web` folder, there is one specific setting you need to configure during deployment.

## Prerequisites

1.  **GitHub Account**: You should have the project pushed to your GitHub repository (which we just did).
2.  **Vercel Account**: Sign up at [vercel.com](https://vercel.com) if you haven't already.

## Steps to Deploy

1.  **Log in to Vercel** and go to your **Dashboard**.
2.  Click **"Add New..."** and select **"Project"**.
3.  **Import Git Repository**:
    *   Find `SoundScape` in the list of your repositories.
    *   Click **"Import"**.
4.  **Configure Project**:
    *   **Project Name**: You can leave it as `SoundScape` or change it.
    *   **Framework Preset**: Vercel should automatically detect it as "Other" or "Static". If not, select **"Other"**.
    *   **Root Directory** (IMPORTANT):
        *   Click **"Edit"** next to Root Directory.
        *   Select the `web` folder.
        *   This ensures that `index.html` is served from the root URL (e.g., `soundscape.vercel.app`) instead of `soundscape.vercel.app/web`.
5.  **Deploy**:
    *   Click **"Deploy"**.
    *   Wait for the build to complete (it should be very fast as it's a static site).

## Verification

Once deployed, visit the provided URL.
*   Check that the charts load correctly.
*   The data is now located at `web/data/spotify_songs.csv`, so the application should find it automatically.

## Updates

Whenever you push changes to the `master` branch on GitHub, Vercel will automatically redeploy your site.
