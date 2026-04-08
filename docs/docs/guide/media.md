---
sidebar_position: 4
title: Managing Media
---

# Managing Media

The Media page is your library of videos and images that you can project onto surfaces. Upload your content here, then assign it to any surface from the workspace.

![Media Library](/img/screenshots/ui-media.png)

## The Media Library

The Media page shows all your uploaded files as a grid of thumbnails. Each thumbnail displays a preview frame so you can quickly identify your content. Video files also show metadata beneath the thumbnail:

- **Resolution** (e.g., 1920x1080)
- **Frame rate** (e.g., 30 fps)
- **Duration** (e.g., 0:45)
- **Codec** (e.g., H.264)

## Uploading Files

There are two ways to add media:

1. **Drag and drop** -- drag files from your computer directly onto the Media page
2. **Click to browse** -- click the upload area and select files from your file picker

Files become available immediately after upload. PhantomCast automatically generates a thumbnail for each file.

## Supported Formats

### Video

- **MP4 with H.264 codec** is the recommended format for the best performance
- Other video formats may work but H.264 gives you the smoothest playback

### Images

- PNG, JPEG, GIF, BMP, and WebP are all supported
- Images display as static content on the assigned surface

## Assigning Media to a Surface

Once your files are uploaded, you assign them from the workspace:

1. Go to the **Workspace** and select a surface
2. In the inspector panel, open the **Source** dropdown
3. Pick the video or image you want to display
4. The content appears on the surface immediately

You can change the source at any time by selecting a different file from the dropdown. Setting the source to "none" makes the surface go black.

## Deleting Files

To remove a file from your library:

1. Find the file in the Media page
2. Click the **delete** button on its thumbnail
3. Confirm the deletion

If a deleted file was assigned to a surface, that surface will display black until you assign a new source.

:::note
Keep an eye on your available storage space, especially when working with large video files. The Settings page shows your current disk usage.
:::
