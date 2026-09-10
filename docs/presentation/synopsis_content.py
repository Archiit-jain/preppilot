"""
The synopsis content, held once and rendered to both .docx and .md.

Section lengths are trimmed to the caps stated in the university's format:
Introduction 1 page, Rationale 1-2 paragraphs, Objectives 3-4, Literature
Review 1 page, Feasibility Study max 1 page, Methodology max 1 page,
Facilities 1 paragraph, Expected outcomes 1 paragraph.
"""

TITLE = "PrepPilot — An Offline-First, AI-Assisted Study and Examination Preparation Platform"
TEAM = ["Archit Jain", "Vanshika Rajput", "Lavi Chaudhary", "Jasmine Chaudhary"]
GUIDE = "Ms. Kareena"
BRANCH = "Computer Science and Engineering (Artificial Intelligence and Machine Learning)"
BLANK = "____________________"

DETAILS_ROWS = [
    ["Field", "Details"],
    ["Name of Students", "; ".join(TEAM)],
    ["University Roll No.", BLANK],
    ["Class Roll No.", BLANK],
    ["Branch", BRANCH],
    ["Batch", BLANK],
    ["Semester", "3rd Semester"],
    ["Proposed Topic", TITLE],
    ["Submitted by", "; ".join(TEAM)],
    ["Supervisor", GUIDE],
]

TOC_ROWS = [
    ["S. No.", "Content", "Page No."],
    ["1", "Introduction", "3"],
    ["2", "Rationale", "4"],
    ["3", "Objectives", "4"],
    ["4", "Literature Review", "5"],
    ["5", "Feasibility Study", "6"],
    ["6", "Methodology / Planning of Work", "7"],
    ["7", "Facilities Required for Proposed Work", "8"],
    ["8", "Expected Outcomes", "9"],
    ["9", "References", "10"],
    ["—", "Appendix A: System Diagrams", "11"],
]

# ---------------------------------------------------------------- body blocks
# ("h1", text) section heading, 14 pt bold
# ("h2", text) sub-heading, 12 pt normal
# ("p",  text) body paragraph
# ("bl", lead, rest) body paragraph with a bold lead-in
# ("num", [items]) numbered list
# ("fig", path, caption, width_cm)
# ("pb",) page break

BODY = [
    ("pb",),
    ("h1", "1. Introduction"),
    ("p",
     "PrepPilot is an offline-first, AI-assisted mobile application that helps a "
     "student organise an examination syllabus, record what has genuinely been "
     "completed, time their study, and revise — with or without an active "
     "internet connection. The project lies in the field of mobile application "
     "development, drawing on offline-first distributed systems and applied "
     "artificial intelligence."),
    ("p",
     "The application is built around one organising idea: a student's syllabus "
     "is a structure, and progress is a measurement over that structure. A "
     "syllabus is represented as a four-level hierarchy — Subject → Chapter → "
     "Topic → optional Sub-topic — and every other feature attaches to it. Study "
     "timers, flashcards, notes and the AI assistant all reference a topic."),
    ("p",
     "The system is implemented using React Native with the Expo framework, "
     "written in TypeScript. Data is stored on the device in an SQLite database "
     "accessed through the Drizzle ORM. The cloud component uses Supabase, "
     "providing PostgreSQL, authentication and serverless Edge Functions. AI "
     "assistance is provided by Google Gemini, reached only through a server-side "
     "Edge Function so that the API credential never reaches a student's "
     "device."),
    ("h2", "1.1 Special technical terms"),
    ("bl", "Offline-first.",
     " The local device database is the authoritative source of truth and the "
     "network is optional. Every read and write completes locally, and "
     "synchronisation is a separate, later concern."),
    ("bl", "Tombstone.",
     " A record marked as deleted rather than physically removed. Without one, a "
     "row deleted while offline would be re-inserted by the next synchronisation, "
     "which cannot distinguish “deleted here” from “not yet seen”."),
    ("bl", "UUIDv7.",
     " A time-ordered unique identifier generated on the client, so a record "
     "created offline carries its final identity at once and is later recognised "
     "as the same record rather than as a duplicate."),
    ("bl", "Row Level Security.",
     " A PostgreSQL feature attaching access rules to rows, so isolation between "
     "users is enforced by the database itself."),

    ("h1", "2. Rationale"),
    ("p",
     "Students preparing for board examinations, competitive entrance "
     "examinations and professional qualifications face a problem that is "
     "organisational rather than academic. A CBSE Class 12, JEE Main or UPSC "
     "Civil Services syllabus each contains hundreds of individually learnable "
     "topics spread across subjects and chapters. Students commonly track these "
     "on paper, in spreadsheets, or from memory. Paper cannot compute a "
     "percentage, spreadsheets are laborious to maintain on a phone, and memory "
     "is least reliable exactly when reliability matters most. Meanwhile revision "
     "tooling, study timing and note-taking are spread across three or four "
     "unrelated applications, none of which holds the syllabus they should all "
     "refer to. Study also frequently happens where connectivity does not — in "
     "libraries, hostels and on trains — so an application that needs a network "
     "round-trip to tick a checkbox is unusable precisely where it is needed."),
    ("p",
     "A second and more serious concern motivates the project: an inaccurate "
     "progress figure is worse than no figure at all. Consider a subject of two "
     "chapters, one with a single completed topic and one with ninety-nine "
     "topics of which none is complete. Averaging the chapter percentages gives "
     "(100% + 0%) ÷ 2 = 50%. The truthful figure, completed topics divided by "
     "total topics, is 1 ÷ 100 = 1%. The averaging method is the obvious "
     "implementation and it is wrong by a factor of fifty. A student who believes "
     "they are halfway through a subject they have barely begun will allocate "
     "their remaining weeks incorrectly. PrepPilot therefore treats correct "
     "measurement as its central obligation rather than a display detail."),

    ("h1", "3. Objectives"),
    ("p", "The project has four principal objectives."),
    ("bl", "Objective 1 — To model an examination syllabus as a structured "
           "hierarchy and measure progress over it accurately.",
     " Completion must be computed in a topic-weighted manner rather than by "
     "averaging chapter percentages, and a portion of the syllabus containing "
     "nothing to measure must be reported as unmeasured rather than as zero per "
     "cent complete."),
    ("bl", "Objective 2 — To design and implement an offline-first data "
           "architecture in which the device database is authoritative.",
     " Every read and write must complete against local storage regardless of "
     "network availability, and changes made on more than one device must later "
     "reconcile through a deterministic, device-independent rule."),
    ("bl", "Objective 3 — To integrate AI assistance without exposing "
           "credentials and without permitting unsupervised modification of the "
           "student's work.",
     " The AI credential must remain server-side at all times, and any change the "
     "assistant proposes must pass through explicit human review and confirmation "
     "before it is applied."),
    ("bl", "Objective 4 — To provide an integrated study workflow bound to the "
           "same syllabus structure.",
     " Study timing, flashcard revision, note-taking and reminders must all "
     "reference the syllabus, so that recorded effort, revision material and "
     "progress remain connected rather than fragmented across separate tools."),

    ("h1", "4. Literature Review"),
    ("bl", "4.1 The spacing effect.",
     " Ebbinghaus [1] established that retention decays predictably over time and "
     "that review restores it. Cepeda et al. [2] synthesised distributed-practice "
     "studies quantitatively and confirmed that material reviewed at spaced "
     "intervals is retained substantially better than material reviewed in a "
     "single massed session. This provides the justification for a spaced review "
     "facility, and informs PrepPilot's flashcard module."),
    ("bl", "4.2 The SM-2 scheduling algorithm.",
     " Wozniak and Gorzelanczyk [3] proposed SM-2, which assigns each item an "
     "ease factor and an interval, grows the interval on successful recall and "
     "resets it on failure. It remains the basis of widely used revision "
     "software, notably Anki. PrepPilot implements SM-2 in full, but its review "
     "screen presently offers four fixed intervals instead, because an adaptive "
     "schedule changes its button labels on every review and a student cannot "
     "learn what a given option will do. The SM-2 statistics are still "
     "maintained, preserving the record needed to adopt adaptive scheduling "
     "later."),
    ("bl", "4.3 Local-first software.",
     " Kleppmann et al. [4] argue that applications should keep primary data on "
     "the user's own device while still supporting synchronisation, setting out "
     "seven ideals including that the network should be optional. PrepPilot "
     "follows this directly."),
    ("bl", "4.4 Conflict resolution in distributed replicas.",
     " Shapiro et al. [5] introduced Conflict-free Replicated Data Types, which "
     "guarantee convergence without coordination but carry significant "
     "implementation and storage overhead. For this project's data, where fields "
     "are independently owned and edits infrequent, last-write-wins with "
     "tombstones and a per-field timestamp for completion converges "
     "deterministically far more cheaply. The review therefore informed a "
     "deliberate decision not to adopt CRDTs."),
    ("bl", "4.5 Review of existing applications.",
     " Anki and Quizlet revise well but hold no syllabus structure and no "
     "progress model. Task managers such as Todoist offer flat lists with no "
     "weighted progress. Timer applications such as Forest, built on Cirillo's "
     "Pomodoro Technique [6], record time alone with no record of what was "
     "studied. Coaching portals require continuous connectivity and track their "
     "own syllabus. No reviewed application combines a structured syllabus, an "
     "honest progress calculation, offline-first operation and integrated study "
     "tooling — the gap this project addresses."),

    ("h1", "5. Feasibility Study"),
    ("bl", "5.1 Technical feasibility.",
     " The project is technically feasible and has been implemented. Expo "
     "provides a mature cross-platform runtime with established modules for local "
     "SQLite storage, secure credential storage and notifications, while Supabase "
     "supplies managed PostgreSQL, authentication and serverless functions, "
     "removing any need to operate custom server infrastructure. The principal "
     "risks were addressed in the design: identifier collision on offline "
     "creation is prevented by client-generated UUIDv7 keys, deletion loss across "
     "synchronisation by tombstones, and device clock skew by taking the "
     "synchronisation watermark from the server's clock rather than the "
     "device's. Two platform limits proved genuinely insurmountable and are "
     "stated rather than concealed: Android does not permit one application to "
     "block another without privileges restricted by Play Store policy, and no "
     "available module exposes the permission needed to toggle Do Not Disturb."),
    ("bl", "5.2 Economic feasibility.",
     " The project incurs no licensing cost. React Native, Expo, SQLite, Drizzle "
     "ORM and PostgreSQL are open-source, and Supabase and Gemini both offer free "
     "tiers adequate for this scale. Because the AI credential is server-side, "
     "usage is bounded by a per-account rate limit enforced in the Edge Function, "
     "preventing uncontrolled expenditure."),
    ("bl", "5.3 Operational feasibility.",
     " The primary interaction — expanding a syllabus and marking topics complete "
     "— requires no instruction. Because the system works without connectivity it "
     "imposes no dependency on the institution's network, and bundled syllabus "
     "templates reduce initial setup, which is where such tools are most often "
     "abandoned."),
    ("bl", "5.4 Need and significance.",
     " The significance of the project lies less in any individual feature than "
     "in the correctness of the measurement it provides. A tool that reports "
     "progress inaccurately actively misleads the student it is meant to help."),

    ("h1", "6. Methodology / Planning of Work"),
    ("bl", "6.1 Research type and approach.",
     " The work follows a constructive, design-and-build methodology in which a "
     "software artefact is designed, implemented and then evaluated against "
     "stated requirements. The unit of study is the application itself. "
     "Development was incremental and decision-logged: each significant "
     "architectural choice was recorded with its reasoning and rejected "
     "alternatives, so the system can be examined not only for what it does but "
     "for why it was built that way."),
    ("bl", "6.2 Methods and tools of data collection and analysis.",
     " Requirements were derived from published examination syllabi and from the "
     "structured review of existing applications in Section 4. Verification is "
     "automated rather than anecdotal: correctness is established by a test suite "
     "executed by continuous integration on every change. The topic-weighting "
     "rule of Section 2, for instance, is protected by an explicit regression "
     "test that fails if progress is ever computed by averaging."),
    ("h2", "6.3 Steps followed"),
    ("num", [
        "Requirement analysis and syllabus modelling.",
        "Design of the shared domain layer — progress, timing, scheduling and "
        "conflict resolution as pure, framework-independent logic.",
        "Local data layer: the SQLite schema through Drizzle ORM, with "
        "client-generated identifiers, tombstones and synchronisation status.",
        "User interface, against a shared design system.",
        "Cloud layer: PostgreSQL migrations with Row Level Security policies.",
        "Synchronisation engine: the pull, merge and push cycle.",
        "AI integration: the Edge Function holding the Gemini credential, and the "
        "proposal and confirmation flow.",
        "Testing and validation on a physical Android device.",
    ]),
    ("bl", "6.4 Working flow.",
     " The operational flow is shown in Figure 1 of Appendix A. A student signs "
     "in, imports or creates a syllabus, and works against it. Every action "
     "writes to the local database immediately and is marked pending. When "
     "connectivity returns, the engine pulls remote changes, merges them and "
     "pushes the agreed result. The critical property is that the local write "
     "completes regardless of network state, so no student action waits on "
     "connectivity. The system architecture and the AI request path are shown in "
     "Figures 2 and 3 of the same appendix."),

    ("h1", "7. Facilities Required for Proposed Work"),
    ("bl", "Software.",
     " Node.js 22 or later with the pnpm package manager, the Expo command-line "
     "tooling and Expo Application Services build service, the Supabase "
     "command-line tools, the Deno runtime for Edge Functions, and Git with a "
     "GitHub repository for version control and continuous integration. Accounts "
     "are required on Supabase, for the cloud database, authentication and "
     "function hosting, and on Google AI Studio for a Gemini API credential. "
     "Development is performed in Visual Studio Code with TypeScript tooling."),
    ("bl", "Hardware.",
     " A development computer with at least 8 GB of RAM, and a physical Android "
     "device running Android 8.0 or later for testing, since notification "
     "delivery, keeping the screen awake, secure credential storage and "
     "application state transitions cannot be verified reliably in an emulator or "
     "a browser. No server hardware is required, as the cloud components are "
     "hosted services."),

    ("h1", "8. Expected Outcomes"),
    ("p",
     "The expected outcome is a working Android application, and this has been "
     "achieved. The delivered system provides a four-level syllabus tracker with "
     "topic-weighted progress; three study timer modes recording sessions against "
     "the syllabus with Pomodoro break time excluded; a dashboard reporting "
     "completion, study time and streaks; flashcards, notes and reminders bound "
     "to the syllabus; a Focus Mode that states its own platform limits in the "
     "interface; an AI assistant providing explanation, summarisation and quiz "
     "generation through a server-side proxy; twenty-two bundled syllabus "
     "templates; support for multiple concurrent courses; and cross-device "
     "synchronisation with deterministic conflict resolution, every user's data "
     "isolated at the database by Row Level Security. Correctness is evidenced "
     "by an automated suite of 1,799 tests "
     "across 80 suites, all passing under continuous integration, and the "
     "application has been built as an Android package and tested on a physical "
     "device. Known limitations are documented rather than concealed: flashcard "
     "review uses fixed intervals rather than adaptive scheduling, the local "
     "database is not encrypted, browser-build reminders do not survive the tab "
     "closing, and testing has not been systematic across Android versions and "
     "manufacturer battery-optimisation policies."),

    ("pb",),
    ("h1", "9. References"),
    ("refs", [
        "[1] H. Ebbinghaus, Memory: A Contribution to Experimental Psychology. "
        "New York, NY, USA: Teachers College, Columbia University, 1913. "
        "(Original work published 1885.)",
        "[2] N. J. Cepeda, H. Pashler, E. Vul, J. T. Wixted, and D. Rohrer, "
        "“Distributed practice in verbal recall tasks: A review and quantitative "
        "synthesis,” Psychological Bulletin, vol. 132, no. 3, pp. 354–380, 2006.",
        "[3] P. A. Wozniak and E. J. Gorzelanczyk, “Optimization of repetition "
        "spacing in the practice of learning,” Acta Neurobiologiae Experimentalis, "
        "vol. 54, no. 1, pp. 59–62, 1994.",
        "[4] M. Kleppmann, A. Wiggins, P. van Hardenberg, and M. McGranaghan, "
        "“Local-first software: You own your data, in spite of the cloud,” in "
        "Proc. ACM SIGPLAN Int. Symp. New Ideas, New Paradigms, and Reflections "
        "on Programming and Software (Onward!), Athens, Greece, 2019, "
        "pp. 154–178.",
        "[5] M. Shapiro, N. Preguiça, C. Baquero, and M. Zawirski, "
        "“Conflict-free replicated data types,” in Proc. 13th Int. Symp. "
        "Stabilization, Safety, and Security of Distributed Systems (SSS), "
        "Grenoble, France, 2011, pp. 386–400.",
        "[6] F. Cirillo, The Pomodoro Technique: The Life-Changing "
        "Time-Management System. London, U.K.: Virgin Books, 2018.",
        "[7] Meta Platforms, Inc., “React Native documentation.” [Online]. "
        "Available: https://reactnative.dev/",
        "[8] Expo, “Expo documentation.” [Online]. Available: "
        "https://docs.expo.dev/",
        "[9] Supabase, Inc., “Supabase documentation.” [Online]. Available: "
        "https://supabase.com/docs",
        "[10] Drizzle Team, “Drizzle ORM documentation.” [Online]. Available: "
        "https://orm.drizzle.team/",
        "[11] Google, “Gemini API documentation.” [Online]. Available: "
        "https://ai.google.dev/docs",
        "[12] P. Leach, M. Mealling, and R. Salz, A Universally Unique IDentifier "
        "(UUID) URN Namespace, IETF RFC 4122, 2005; superseded by RFC 9562, 2024.",
    ]),

    ("pb",),
    ("h1", "Appendix A: System Diagrams"),
    ("p",
     "The diagrams below support Section 6. They are placed here so that the "
     "Methodology section remains within its stated one-page limit."),
    ("fig", "workflow.png", "Figure 1: Working flow of the PrepPilot system", 13.8),
    ("fig", "architecture.png", "Figure 2: System architecture", 11.5),
    ("fig", "ai-flow.png",
     "Figure 3: AI request flow through the Supabase Edge Function", 12.5),
]
