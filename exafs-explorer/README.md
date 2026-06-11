# Dr-XAS Website

Welcome to the repository for the **Dr. XAS Website**. This project serves as the landing page and portfolio interface for the Dr. XAS ecosystem, an AI companion for X-ray absorption spectroscopy.

**🌍 Live Website:** [dr-xas.org](https://dr-xas.org)

## Overview

The website features an interactive landing page (currently highlighted by the `magma-particles-demo`) that showcases:

- **Dr. XAS**: The next generation AI companion for X-ray absorption spectroscopy.
- **EasyXASCalc**: Advanced calculation and spectrum analysis.
- **XASbenchmark**: Standardized datasets and benchmarking tools.

It utilizes modern web design principles including:

- Interactive 3D particle canvas backgrounds.
- Typing animations.
- Fully responsive design for desktop and mobile devices.
- Direct links to community platforms (GitHub, X, Discord) and a beta access signup form.

## Project Structure

- `magma-particles-demo/` - Contains the main demonstration landing page.
  - `index.html` - The core HTML structure of the page.
  - `style.css` - Custom styles, layout designs, and mobile responsiveness logic.
  - `script.js` - Interactive canvas logic (particle wave animations) and typing effects.
  - `drxas_logo.png` & `drxas_logo_small.png` - Project branding assets.
  - `assets/` - Directory for demo videos and extra resources.

## Local Development

Since this is a static website (HTML, CSS, JS), you can serve it locally using Python's built-in HTTP server:

```bash
# Navigate to the project demo directory
cd magma-particles-demo/

# Start a local web server (Python 3)
python3 -m http.server 8080
```

After running the server, navigate to `http://localhost:8080/` in your web browser to view the site.

## Deployment

This website is designed and configured to be easily deployed via **GitHub Pages**.

Any pushes to the main branch will automatically update the live static website served by GitHub automatically.

## Contact

- **Email**: <dr.xas.drx@gmail.com>
- **Discord**: [Join our community](https://discord.gg/cxefJpZQ)
- **X**: [@drx_xas](https://x.com/drx_xas)
- **GitHub**: [Dr-XAS Organization](https://github.com/Dr-XAS)
