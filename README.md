# GROUP9 TUP Learning & Assessment System

GROUP9 is now a plain JavaScript React/Vite SPA backed by an Express REST API.

## Run locally

1. Copy `server/.env.example` to `server/.env` and set a real MongoDB Atlas connection string and JWT secret. Do not leave the example `your-cluster.mongodb.net` hostname in place.
2. Optionally copy `client/.env.example` to `client/.env`.
3. Install dependencies from the repository root:

```powershell
npm install
```

4. Start both applications:

```powershell
npm run dev
```

The Vite client runs at `http://localhost:5173` and the Express API runs at `http://localhost:5000`.

## Production

```powershell
npm run build
npm start
```

Deploy the client to Vercel and the Express API to Render or Railway. The Vercel rewrite in `client/vercel.json` proxies API and asset requests to the deployed API, keeping browser authentication on the Vercel origin. Set `CLIENT_URL` on the API host to the production Vercel origin, and leave `VITE_API_URL` unset in Vercel so the client uses that proxy.

Uploaded profile images and faculty presentation files are stored in Cloudinary. Create a Cloudinary account, then add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from the Cloudinary dashboard to the backend host's environment variables. Do not expose these credentials in Vercel or commit them. After deploying the backend with these values, newly uploaded files will be stored persistently; existing files must be uploaded again from the faculty topic editor.

### Temporary GitHub Pages deployment

The client is configured to deploy automatically to:
`https://chiffuu144.github.io/tomonwork/`

Enable **Settings → Pages → GitHub Actions** in the repository. The workflow in
`.github/workflows/deploy-pages.yml` then builds and publishes the `client` app on
each push to `main`. GitHub Pages hosts only the static frontend; login, registration,
subjects, quizzes, and uploads still require the Express API and MongoDB to be
deployed separately. Add a repository variable named `VITE_API_URL` containing the
public backend origin before expecting authentication to work.

## Structure

- `client/src`: React pages, reusable components, auth context, router, and export utilities.
- `server`: Express entry point, JWT middleware, Mongoose models, REST endpoints, and upload handling.

## Topic materials

Place lesson assets in `public/topics/`. The API recursively indexes that directory through
`GET /api/topic-assets?subjectId=<id>&topicNum=<number>` and serves each file through an
authorized `/api/topic-assets/file` URL. Students only receive or download files for topics
they have unlocked.
Existing files named `ITPE3-G2`, `ITPE3-G3`, `ITPE3-G5`, and `ITPE3-G6` are automatically
associated with Topics 2, 3, 5, and 6. PDFs and PPTX presentations are previewed in the
lesson page; PPTX slides include in-page navigation and a download option. Legacy `.ppt`
files can be downloaded but are not previewed in the browser.

Faculty can manage topics from the subject roadmap using
`/subjects/:subjectId/topic/:topicNumber/edit`. The editor supports lesson notes,
PDF/PPT/PPTX uploads, custom in-app slides, summaries, a True/False self-assessment, and
the verified-complete badge. Students use
`/subjects/:subjectId/topic/:topicNumber/view`; they must pass the previous topic's quiz
before opening the next topic, then answer its self-assessment correctly before its quiz
is unlocked. Lesson HTML is sanitized before display.

Faculty can author one quiz per topic from the subject management page or batch import
quizzes using JSON, CSV, plain-text, text-based PDF, or Word `.docx` files. PDF and DOCX imports
extract text in the browser and must follow the same labeled, blank-line-separated format as TXT;
scanned/image-only PDFs and legacy `.doc` files are not supported. CSV imports use one question per row with headers
`topicNumber,title,timeLimitMinutes,type,questionText,choices,correctAnswer,points`;
separate multiple-choice options with `|`. JSON files may be an array or an object with a
`quizzes` array; each quiz contains `topicNumber`, `title`, `timeLimit` (seconds, optional),
and a `questions` array with `type`, `questionText`, `choices`, `correctAnswer`, and
`points`. Plain-text files use a quiz-details block (`topicNumber`, `title`, and optional
`timeLimitMinutes`) followed by blank-line-separated question blocks with `type`,
`questionText`, `choices`, `correctAnswer`, and optional `points`. Quiz timers are configurable from 1 to 20
minutes, and the passing threshold is fixed at 75%. The API records each attempt's start
time and enforces the timer and score threshold. A topic must have a self-assessment
before its quiz can be saved.

The roadmap includes the six required starting steps and expands for additional topics;
the grade matrix uses every published topic in the subject.
Faculty reports support surname and ascending/descending score sorting, print views, PDF,
CSV, and XLSX exports. New learners may sign in using either username or email; the
registration form supports Primary learner and Faculty roles. Subjects support 1st Sem,
2nd Sem, and Summer terms.

Student IDs are generated by the server during registration (and backfilled when an
existing student signs in) in the format `TUP-STU-YYYY-XXXXXX`. Student IDs cannot be
edited from the profile page. Registration and `/profile` support an optional profile
image upload.
