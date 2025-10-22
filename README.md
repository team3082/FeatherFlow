# 🪶 FeatherFlow

> **FRC Autonomous Path Planning Studio**

[![Team](https://img.shields.io/badge/Team-3082-blue.svg)](https://www.team3082.org)
[![Development Status](https://img.shields.io/badge/Status-Active%20Development-orange.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)]()

FeatherFlow is a modern desktop application for creating and visualizing autonomous robot paths for FIRST Robotics Competition (FRC) teams. Built with Next.js and Tauri, it provides an intuitive interface for designing complex robot trajectories using Bezier curves and behavioral control points.

## ✨ Key Features

### 🎨 **Interactive Path Studio**
- **Visual Canvas Editor**: Drag-and-drop path creation with real-time field visualization
- **Zoom & Pan Controls**: Navigate large field layouts with smooth zooming and panning
- **2025 Reefscape Field**: Pre-configured for the current FRC game field dimensions
- **Real-time Path Preview**: Instant visual feedback as you build paths

### 🎯 **Dual-Point Architecture**
- **Anchor Points**: Define the geometric path your robot follows using Bezier curves
- **Control Points**: Add behavioral commands at specific positions along the path:
  - **Rotate Points**: Specify robot heading changes
  - **Stop Points**: Define controlled stops with duration
  - **Command Points**: Execute custom robot actions

### 🛠️ **Advanced Editing Tools**
- **Curve Handles**: Intuitive Bezier curve manipulation with aligned handles
- **Point Insertion**: Click on curves to add new anchor points
- **Properties Panel**: Detailed editing of point positions and attributes
- **Point Lists**: Organized views of all anchor and control points

### � **Project Management**
- **Save/Load Projects**: Manage multiple autonomous routines
- **Path Previews**: Visual thumbnails for quick project selection
- **Duplicate & Edit**: Clone existing paths for rapid iteration

## 🏗️ Architecture Overview

```
FeatherFlow Architecture
├── 🎨 Frontend (Next.js + TypeScript + Tailwind CSS)
│   ├── Landing Page
│   ├── Project Browser
│   └── Visual Path Studio
├── ⚡ Desktop App (Tauri + Rust)
│   ├── Native Performance
│   └── Cross-Platform Support
└── 🧮 Core Mathematics
    ├── Bezier Curve Engine
    ├── Coordinate Conversion
    └── Path Optmization (In Rust)
```

### Core Components

- **`AnchorPoint`**: Defines path geometry with Bezier handles
- **`ControlPoint`**: Behavioral modifiers positioned along the curve
- **`BezierCurve`**: Mathematical foundation for smooth path generation
- **`Vector2`**: 2D mathematics for precise field positioning
- **Canvas Coordinate System**: Automatic conversion between pixels and field inches

## 🎯 Perfect for FRC Teams

FeatherFlow is designed specifically for FRC teams who need:

- **Rapid Prototyping**: Quick iteration on autonomous strategies
- **Precise Control**: Sub-inch accuracy for field positioning
- **Visual Planning**: See your robot's path before deployment
- **Team Collaboration**: Share and iterate on path designs

## 🚧 Current Development Status

FeatherFlow is actively being developed with core functionality in place:

### ✅ **Implemented Features**
- Interactive field canvas with 2025 Reefscape background
- Anchor point creation and Bezier curve drawing
- Control point system for behavioral commands
- Zoom, pan, and reset view controls
- Point selection and properties editing
- Project management with save/load capabilities
- Real-time path visualization

### 🔄 **In Development**
- Path export to wplib
- Advanced control point behaviors
- Timeline-based path sequencing
- Physics simulation and validation
- Multi-path autonomous routines

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Rust (for Tauri backend)
- npm/yarn/pnpm

### Getting Started

```bash
# Clone the repository
git clone https://github.com/EmilioMGithub/FeatherFlow.git
cd FeatherFlow

# Install dependencies
npm install

# Start development server
npm run dev

# Launch Tauri desktop app (development)
npm run tauri dev
```

### Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run build` - Build for production
- `npm run tauri dev` - Launch Tauri development app
- `npm run tauri build` - Build desktop application
- `npm run lint` - Run ESLint

## 🤝 Contributing

FeatherFlow welcomes contributions from FRC teams and the robotics community!

### Development Guidelines
- Follow TypeScript best practices
- Maintain the dual-point architecture philosophy
- Test path mathematics thoroughly
- Document new features and behaviors

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built for FRC Team 3082**

[Team Website](https://www.team3082.org) • [Report Bug](https://github.com/team3082/FeatherFlow/issues) • [Request Feature](https://github.com/team3082/FeatherFlow/issues)

</div>
