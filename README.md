# ACCELA

> A modern flashcard-based learning platform built with Node.js, Express, MongoDB, and EJS  
> Designed and developed by Neda Nawed

---

## Overview

ACCELA helps students master subjects through active recall using flashcards.  
It supports login/signup, admin management, and CRUD operations for flashcards organized by topics and chapters.

---

## Features

- Authentication
  - Secure login system with JWT & cookies
  - Role-based access control (user/admin)

- Flashcard System
  - Create, read, update, and delete flashcards
  - Organized by topic and chapter
  - Bulk flashcard uploads via JSON

- Admin Panel
  - Manage users, topics, chapters, and flashcards
  - Full CRUD operations from one place

- Frontend
  - Built using EJS templating
  - Custom UI with CSS
  - Urdu/RTL support for Unani subjects

---

## Tech Stack

- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose
- Templating: EJS
- Authentication: JWT + Cookie Parser
- File Uploads: Multer
- Styling: Custom CSS

---

## Installation

```bash
git clone https://github.com/your-username/accela.git
cd accela
npm install
```

Create a .env file and add:
```env
MONGO_URI=your_mongodb_url
JWT_SECRET=your_jwt_secret
```

Then run:
```bash
npm start
```

---



## Notes

- This project was built for educational and practical use.
- Inspired by the Unani curriculum, currently focused on Tareekh-e-Tibb and expanding toward Anatomy.

---

## Contact

Made with patience and passion by Neda Nawed
