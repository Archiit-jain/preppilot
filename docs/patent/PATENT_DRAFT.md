<div align="center">

![](../assets/branding/vidya-university-logo.png 'w=6.5')

**CONFIDENTIAL — NOT FOR PUBLICATION BEFORE A PATENT APPLICATION IS FILED**

# Draft Proposal for Patent Filing

## A System and Method for Offline-First Tracking of Study Progress with Conflict-Resolving Synchronisation and a Confirmation-Gated, Multimodal Generative Assistant

**(Working name of the embodiment: PrepPilot)**

Prepared for filing under the Patents Act, 1970 (India)

Specification drafted in the layout of Form 2 (Provisional or Complete Specification)

**Proposed inventors**

Archit Jain · Vanshika Rajput · Lavi Chaudhary · Jasmine Chaudhary

**Under the guidance of**

**Ms. Kareena**

Department of Engineering, Faculty of Computer Science & Engineering

**VIDYA UNIVERSITY, MEERUT**

Baghpat Road, Delhi-Meerut Bypass, Meerut, U.P., India-250002

**Draft version 1.0 · 24 September 2026**

</div>

<!-- pagebreak -->

# Certificate

This is to certify that the draft patent proposal titled **"A System and Method for Offline-First Tracking of Study Progress with Conflict-Resolving Synchronisation and a Confirmation-Gated, Multimodal Generative Assistant"** has been prepared by Archit Jain, Vanshika Rajput, Lavi Chaudhary and Jasmine Chaudhary, students of B.Tech. Computer Science and Engineering (Artificial Intelligence and Machine Learning), Vidya University, Meerut, under my guidance.

To the best of my knowledge, the work described is the original work of the proposed inventors, and it is recommended for examination by the University's Intellectual Property Rights cell and for a professional prior-art search with a view to filing a patent application.

&nbsp;

Signature of Supervisor: ______________________________

Name: **Ms. Kareena**

Designation: ______________________________

Department: Department of Engineering, Faculty of Computer Science & Engineering

Date: ____ / ____ / 2026 &nbsp;&nbsp;&nbsp;&nbsp; Place: Meerut

&nbsp;

Signature of Head of Department: ______________________________

Name: ______________________________

Date: ____ / ____ / 2026

<!-- pagebreak -->

# Declaration by the Proposed Inventors

We, the undersigned, declare that:

1. The system and method described in this draft were conceived and developed by us in the course of our project work at Vidya University, Meerut.
2. To the best of our knowledge the invention has not been published, used in public or filed as a patent application by us or by anyone we are aware of, except for the disclosures listed in Part A, Section A.4 of this document.
3. We will not publish or publicly demonstrate the invention further until the University's IPR cell or the appointed patent agent advises that a patent application has been filed.
4. We understand that inventorship is a question of law and will be finally decided with the patent agent, on the basis of each person's contribution to the conception of what is claimed.

| Name              | University Roll No. | Signature | Date |
| :---------------- | :------------------ | :-------- | :--- |
| Archit Jain       |                     |           |      |
| Vanshika Rajput   |                     |           |      |
| Lavi Chaudhary    |                     |           |      |
| Jasmine Chaudhary |                     |           |      |

Place: Meerut

<!-- pagebreak -->

# Acknowledgement

We are grateful to our supervisor, **Ms. Kareena**, for her guidance throughout the project and for encouraging us to protect the work through the patent system. We thank the Head of the Department and the Faculty of Computer Science & Engineering, Vidya University, Meerut, for the facilities and support that made the project possible.

We also acknowledge the open-source communities behind React Native, Expo, SQLite, Drizzle ORM, PostgreSQL and Supabase, and Google for the Gemini API, on which the prototype is built.

&nbsp;

Archit Jain · Vanshika Rajput · Lavi Chaudhary · Jasmine Chaudhary

<!-- pagebreak -->

# Contents

| Part         | Section                                                |
| :----------- | :----------------------------------------------------- |
| Front matter | Certificate · Declaration · Acknowledgement            |
| **Part A**   | **Invention disclosure (for the University IPR cell)** |
|              | A.1 Summary of the proposal                            |
|              | A.2 Proposed inventors and applicant                   |
|              | A.3 What is believed to be new                         |
|              | A.4 Prior disclosures and their dates                  |
|              | A.5 Stage of development and evidence                  |
|              | A.6 Commercial and social relevance                    |
| **Part B**   | **Draft specification (Form 2 layout)**                |
|              | 1. Title · 2. Applicant · 3. Preamble                  |
|              | 4. Field of the invention                              |
|              | 5. Background of the invention                         |
|              | 6. Objects of the invention                            |
|              | 7. Summary of the invention                            |
|              | 8. Brief description of the drawings                   |
|              | 9. Detailed description of the invention               |
|              | 10. Claims                                             |
|              | 11. Abstract                                           |
| **Part C**   | **Notes for the patent professional**                  |
| **Annexure** | **Screens of the working prototype (illustrative)**    |

<!-- pagebreak -->

# Part A — Invention Disclosure

## A.1 Summary of the proposal

The invention is a system and method for helping a student track progress through an examination syllabus on a mobile device, in which (i) the device's own database is the authoritative record and every action completes without a network; (ii) copies of the record on several devices are reconciled by a deterministic procedure that treats the completion of a topic as a separately time-stamped fact, so that editing a topic on one device can never silently undo the completion recorded on another; and (iii) a generative language model is attached to the record through a guard that makes it structurally impossible for the model to change the student's data on its own: the model's suggestions are parsed into an inert, additive-only proposal that takes effect only after the student reviews and confirms it. The assistant also accepts a photograph of a textbook page or handwritten notes, which the device reduces in size before a server-side function validates it and passes it to the model, and it presents the model's replies as formatted text with mathematical notation rewritten for a phone screen.

A working prototype, **PrepPilot**, implements every element described and has been tested on a physical Android device against a live cloud back end.

## A.2 Proposed inventors and applicant

| Role                | Name / details                                                                                 |
| :------------------ | :--------------------------------------------------------------------------------------------- |
| Proposed inventors  | Archit Jain; Vanshika Rajput; Lavi Chaudhary; Jasmine Chaudhary                                |
| Supervisor          | Ms. Kareena (inventorship to be decided with the patent agent — see Part C.4)                  |
| Proposed applicant  | ______________________ (Vidya University, and/or the inventors, per the University IPR policy) |
| Nationality         | Indian (to be confirmed for each inventor)                                                     |
| Address for service | ______________________                                                                         |
| Contact             | ______________________                                                                         |

## A.3 What is believed to be new

The proposed inventors believe the following, alone and in combination, to be new and not obvious. Part C explains why this belief must be tested by a professional prior-art search before filing.

1. **Completion as an independently time-stamped fact inside a hierarchical study record**, reconciled separately from the rest of the record, with the rule that an exact tie resolves to "completed", and with deletion markers that always take precedence and keep the earliest deletion time.
2. **A pull-merge-push synchronisation order combined with a server-clock watermark that is rewound on every pull and advanced only when a whole pass succeeds**, with retrieval in pages until an empty page, applied to a hierarchy in dependency order.
3. **Topic-weighted progress** computed at read time from unit counts, where a unit is a topic or each of its sub-topics, with an explicit "unmeasured" state for an empty scope instead of zero, and a display rule that never rounds to 100 % while work remains or to 0 % once work has begun.
4. **A confirmation-gated generative assistant**: the model's output can alter the student's record only through a delimited proposal whose grammar contains additive operations and nothing else, which is held as an inert object, presented for review with an exact list and size, bounded by a maximum reviewable size, and applied only on explicit confirmation.
5. **A multimodal question path** in which the device down-scales and re-encodes a photograph before transmission, the server validates media type, encoding and size before any model call is made, and the model receives the image ahead of the question together with an instruction to write mathematics in plain text; the device then renders the reply's formatting and rewrites any remaining mathematical markup as Unicode.

## A.4 Prior disclosures and their dates

Any public disclosure before the filing date can destroy novelty. The following disclosures are known and must be reviewed with the patent agent (Part C.3):

| Disclosure                                                    | Public?                      | Date                    |
| :------------------------------------------------------------ | :--------------------------- | :---------------------- |
| Source code in the GitHub repository `Archiit-jain/preppilot` | No — private repository      | since 10 September 2026 |
| Web demonstration at `preppilottdemo.netlify.app`             | **Yes — publicly reachable** | ____ September 2026     |
| Synopsis submitted to the Department                          | Within the University        | ____ September 2026     |
| First project presentation to faculty                         | Within the University        | ____ September 2026     |
| Android application installed on the inventors' own devices   | No                           | since September 2026    |

## A.5 Stage of development and evidence

- **Working prototype.** An Android application (React Native / Expo) with an equivalent browser build, backed by a Supabase (PostgreSQL) project and a server-side function calling Google's Gemini model.
- **Verified on hardware.** Installed on a physical Android phone; sign-in, synchronisation across an uninstall and reinstall, and questions about a photographed page were exercised against the live back end in September 2026.
- **Automated evidence.** 1,934 automated tests across 91 test suites, all passing under continuous integration, including tests for each merge rule, the synchronisation order, the progress arithmetic, the proposal grammar and the image validation.
- **Engineering record.** Every design decision is recorded with its reason in the project's decision log (`DECISIONS.md`, entries D1–D92), which dates the conception of each element.

## A.6 Commercial and social relevance

India has one of the world's largest populations of students preparing for board and competitive examinations (for example CBSE, JEE, NEET, GATE, UPSC). Many study where connectivity is intermittent. The invention gives them an accurate measure of what they have actually covered, works fully offline, and makes a generative assistant safe to attach to their records — a property that coaching institutes and education-technology companies deploying AI tutors increasingly need. The same method applies to any hierarchical checklist edited on several devices, such as training curricula, compliance checklists and field inspections.

<!-- pagebreak -->

# Part B — Draft Specification

**FORM 2 — THE PATENTS ACT, 1970 (39 of 1970) & THE PATENTS RULES, 2003**

**PROVISIONAL / COMPLETE SPECIFICATION** _(strike out whichever is not applicable; see Section 3 of the Act and Rule 13)_

## 1. Title of the Invention

A SYSTEM AND METHOD FOR OFFLINE-FIRST TRACKING OF STUDY PROGRESS WITH CONFLICT-RESOLVING SYNCHRONISATION AND A CONFIRMATION-GATED, MULTIMODAL GENERATIVE ASSISTANT

## 2. Applicant

| Name                   | Nationality            | Address                |
| :--------------------- | :--------------------- | :--------------------- |
| ______________________ | ______________________ | ______________________ |

## 3. Preamble to the Description

The following specification particularly describes the invention and the manner in which it is to be performed. _(For a provisional specification: "The following specification describes the invention.")_

## 4. Field of the Invention

[001] The present invention relates to data processing systems for education, and in particular to a system and method in which a mobile computing device maintains an authoritative local record of a hierarchical study plan and the progress made through it, reconciles that record with copies held on other devices through a server, and couples the record to a generative language model through a guard that prevents the model from altering the record without the user's explicit confirmation. The invention further relates to the submission of images to such a model from a mobile device and to the presentation of the model's replies on a small screen.

## 5. Background of the Invention

[002] Students preparing for school-leaving, entrance and professional examinations must cover syllabi of several hundred individually learnable topics, arranged by subject and chapter. Progress is commonly recorded on paper, in spreadsheets or in general-purpose task applications. Paper cannot compute a proportion; spreadsheets are laborious to maintain on a phone; and task applications hold flat lists without a notion of the syllabus hierarchy.

[003] Where progress through a hierarchy is computed, it is commonly computed by averaging the percentages of the child nodes. For a subject of two chapters, one containing a single completed topic and the other ninety-nine incomplete topics, averaging reports (100 % + 0 %) / 2 = 50 %, whereas the proportion of work actually done is 1 %. A student relying on such a figure misallocates the time remaining before an examination. Known systems also commonly report an empty scope as 0 % complete, which is indistinguishable from a scope where nothing has been done, and round displayed figures in a way that can show 100 % while work remains.

[004] Much study takes place where network connectivity is absent or unreliable. Applications that store their record on a server require a network round trip to record the completion of a topic and fail where they are most needed. Local-first software, in which the primary copy of data resides on the user's device and synchronisation is a separate concern, has been proposed in the literature (Kleppmann et al., "Local-first software", Onward! 2019). Conflict-free replicated data types (Shapiro et al., 2011) guarantee convergence of replicas but carry substantial implementation and storage cost. Simpler schemes such as whole-record last-writer-wins are cheap but lose data: when one device renames a topic and another marks the same topic complete, keeping the whole record with the later timestamp discards one of the two changes. In study tracking, the change discarded is frequently the completion, which the student will not notice has been lost.

[005] Known synchronisation schemes further suffer from (a) pushing local changes before merging remote ones, which overwrites a change made elsewhere with a record that has not been reconciled; (b) watermarks taken from the device clock, which differs from the server clock so that records written just before a synchronisation are skipped; (c) deletions that are re-created by the next synchronisation because a missing record cannot be distinguished from one not yet received; and (d) server interfaces that silently truncate a response to a maximum number of rows, so that a large record is only partly restored on a new device.

[006] Generative language models are increasingly attached to productivity and education applications as assistants. Where such an assistant is given the ability to act on the user's data — through function calling, tool use or agent frameworks — the permitted actions are described to the model in natural language or as a list of callable functions, and the model may invoke destructive actions such as deleting or marking items complete, whether through error, ambiguity or manipulation by content in its input. Instructions placed in a prompt are not a reliable constraint. Where the assistant is not given such ability, its suggestions arrive as unstructured text that the user must transcribe by hand.

[007] Students often need help with material that exists on paper — a textbook exercise or handwritten notes. Transmitting a full-resolution photograph from a phone to a server-side model is slow on mobile networks and consumes the model provider's quota; a server that forwards any upload to the model spends that quota on content it could have rejected. The replies of such models are commonly written in a markup language and include mathematical notation in a typesetting syntax (for example LaTeX), which a mobile application shows as raw symbols and backslashes that obscure the answer.

[008] There is accordingly a need for a system that measures study progress truthfully, works completely offline, reconciles records edited on several devices without losing completions or resurrecting deletions, and allows a generative assistant — including one that reads images — to contribute to the record without being able to modify it on its own.

## 6. Objects of the Invention

[009] The principal object of the invention is to provide a system and method for tracking progress through a hierarchical study plan that remains fully functional without a network connection.

[010] Another object is to compute progress in a manner that weights every unit of work equally at every level of the hierarchy, and that distinguishes a scope with nothing to measure from a scope with nothing done.

[011] Another object is to reconcile copies of the study record held on several devices deterministically, such that the completion of a topic is never lost because of an unrelated edit to the same topic, and a deletion is never undone by synchronisation.

[012] Another object is to synchronise without skipping records because of clock differences between devices and server, and without partial restoration when the server limits the size of a response.

[013] Another object is to couple a generative language model to the study record such that the model is structurally incapable of deleting, completing or reordering any part of the record, and can add to it only after the user has reviewed and confirmed an exact description of the addition.

[014] Another object is to allow a user to ask the model about an image captured on the device while minimising data transmitted and model quota consumed, and rejecting unsuitable images before the model is invoked.

[015] Another object is to present the model's replies on a small screen as formatted text, with mathematical notation rendered legibly without a typesetting engine.

[016] A further object is to keep every credential for the model on the server, so that no device or web page carries it.

## 7. Summary of the Invention

[017] According to one aspect, the invention provides a computer-implemented method in which a user device stores a hierarchical study plan — subjects, chapters, topics and optional sub-topics — in a local relational database that is the authoritative copy. Every record carries a client-generated, time-ordered identifier, an update time and a deletion marker; every topic and sub-topic additionally carries a completion state and a completion-change time kept separately from its update time. Every operation completes locally and marks the record pending; a deletion sets the deletion marker instead of removing the record.

[018] Progress for any scope is computed when read, never stored, as completed units divided by total units, where a unit is a topic without sub-topics or each sub-topic of a topic. A scope with no units is reported as unmeasured. The displayed figure is never rounded up to 100 % while any unit is incomplete, nor down to 0 % once any unit is complete.

[019] According to another aspect, on a trigger — the user signing in, a periodic interval while the application is in the foreground, the application leaving the foreground, or connectivity being restored — the device performs a synchronisation pass over the record types in dependency order. For each type it first retrieves, page by page until an empty page, the records the server has changed since a watermark rewound by a fixed interval; reconciles them with local records by identifier; merges each conflicting pair by rules under which a deletion marker always prevails and the earliest deletion time is kept, completion is resolved by the later completion-change time independently of every other field, an exact tie in completion-change time resolves to "completed", other fields are taken from the copy with the later update time and an exact tie keeps the local copy; stores a result combining both copies as pending; and only then transmits every pending record. The watermark is advanced to the latest server-assigned time seen, and only when the whole pass succeeds.

[020] According to a further aspect, the device submits the user's question to a server-side proxy that alone holds the model credential and adds an instruction describing a delimited proposal format. The device separates any proposal block from the reply's prose and validates it against a grammar whose only operations add chapters or add topics to a named subject. A block that fails validation is discarded, so that the reply cannot affect the record; a valid block is held as an inert proposal. The user is shown every item the proposal would add, and on explicit confirmation — and only if the proposal does not exceed a maximum reviewable size — the additions are written to the local database and marked pending.

[021] According to a further aspect, the device down-scales a captured or selected image so that its longest side does not exceed a maximum dimension, re-encodes it in a lossy format, and sends it with the question. The server validates the image's media type, encoding and size and rejects an unsuitable image before invoking the model; it applies a per-account rate limit, and composes a model request in which the image precedes the question together with an instruction to express mathematics in plain text. The device parses the reply's markup into styled blocks and rewrites any remaining mathematical markup as Unicode characters.

[022] The invention also provides a system comprising a user device and a server configured to perform the methods, and a non-transitory computer-readable medium carrying instructions for them.

## 8. Brief Description of the Drawings

[023] The accompanying drawings illustrate an embodiment of the invention and, with the description, explain its principles:

- **FIG. 1** is a block diagram of the system, showing the user device 100, the server system 200, the generative model service 300 and the network 400.
- **FIG. 2** shows the hierarchical data model and illustrates topic-weighted progress against averaging.
- **FIG. 3** is a flow chart of one synchronisation pass.
- **FIG. 4** is a decision diagram of the rules by which two copies of a record are merged.
- **FIG. 5** is a flow chart of the confirmation-gated handling of a model reply.
- **FIG. 6** is a flow chart of a question accompanied by an image, from capture to display of the reply.

[024] The Annexure reproduces screens of the working prototype for illustration only; they do not form part of the formal drawings.

## 9. Detailed Description of the Invention

[025] The following description refers to the drawings. It describes a preferred embodiment, the PrepPilot prototype, in sufficient detail for a person skilled in the art to perform the invention. The embodiment is exemplary; variations within the scope of the claims will be apparent to such a person, and the terminology is used for description and not limitation.

### 9.1 System overview (FIG. 1)

[026] The user device 100 is a smartphone, tablet or computer with a processor, memory, a display and input 102 (a touch screen and, optionally, a camera), and non-volatile storage. The device executes an application organised in layers: a presentation layer 110 of screens; a state layer 120 of per-feature stores that orchestrate operations but hold no derived values; a progress engine 140; a proposal validator and review interface 170; a local relational database 130; a synchronisation engine 150; an assistant client and reply renderer 160; an image pre-processor 162; and a session scheduler 180 that decides when synchronisation runs.

[027] In the preferred embodiment the application is written in TypeScript using React Native and Expo for Android, and the same code is exported to a web browser. The local database 130 is SQLite, accessed through the Drizzle object-relational mapper; in the browser the same schema runs in SQLite compiled to WebAssembly (sql.js). All pure decision logic — progress arithmetic, merge rules, proposal parsing, timer state — resides in a platform-independent package so that every embodiment computes identical results.

[028] The server system 200 comprises an authentication service 210, a cloud database 220 (PostgreSQL in the preferred embodiment, provided by Supabase) with row-level security 222, and an AI proxy function 230 running as a serverless function. The proxy comprises a request validator 232, a rate limiter 234, a credential store 236 holding the key for the generative model service 300, and an instruction composer 238. The device communicates with the server over the network 400; it never communicates with the model service directly.

### 9.2 Hierarchical record and topic-weighted progress (FIG. 2)

[029] A study plan belongs to a course 500 and comprises subjects 510, each comprising chapters 520, 522, each comprising topics 530, each optionally comprising sub-topics 540. A user may hold several courses and switches between them. Courses may be created from bundled syllabus templates (the prototype carries twenty-two, including JEE Main, JEE Advanced, NEET UG, ten CBSE streams, UPSC CSE, SSC CGL, GATE CS/IT and CA), from a form in which the user enters the course, its subjects, chapters and topics and saves once at the end, or by the assistant's confirmed proposals (Section 9.6).

[030] Progress is never stored. The progress engine 140 computes it when read, in a single traversal, from the completion states of the units in a scope. A unit is a topic that has no sub-topics, or each sub-topic of a topic that has them. For any scope, progress = completed units ÷ total units 550. Thus the subject of FIG. 2 is reported as 1 / 100 = 1 %, not the 50 % that averaging chapter percentages 552 would report. A scope with no units returns a null value rendered as a dash and announced as "no topics yet" 554, never 0 %.

[031] The formatted figure is clamped at display: while any unit is incomplete it is never shown as 100 %, and once any unit is complete it is never shown as 0 % (for example, 9,999 of 10,000 is shown as 99 %, not 100 %). Because the Tracker screen and the Dashboard call the same function, they cannot disagree.

### 9.3 The local authoritative record

[032] Every record is created on the device with a time-ordered universally unique identifier (UUID version 7) generated on the device, so that a record created offline carries its final identity immediately and is recognised by the server as the same record rather than a duplicate. Every record carries an update time, a deletion marker 134 and a synchronisation status 132 (`pending` or `synced`). Every topic and sub-topic further carries `completed` and `completed_changed_at`, the latter set only when the completion state changes.

[033] Every create, rename, reorder, completion toggle and delete completes against the local database 130 regardless of connectivity and marks the record `pending`. A delete sets the deletion marker and is never a physical removal, so that the deletion itself can be synchronised. In the cloud database 220, row-level security restricts every read and write to rows whose owner is the authenticated user, and no delete permission is granted to clients at all; deletion is therefore possible only by deletion marker.

[034] The study-session timer derives elapsed time from stored start times and banked durations rather than from a counter incremented while the application runs, so that time is recorded correctly when the operating system suspends or terminates the application; break periods in a Pomodoro cycle are excluded from recorded study time, and a session found running after the application was terminated is closed at its last recorded heartbeat and marked abandoned.

### 9.4 Synchronisation (FIG. 3)

[035] The session scheduler 180 starts a synchronisation session when the user signs in and ends it at sign-out. A pass is triggered S300: on sign-in and on each launch; every five minutes while the application is in the foreground; when the application leaves the foreground (the last moment at which work can be transmitted before the operating system may terminate the process); on restoration of network connectivity (a transition, not every connectivity report); and on explicit request. When the device already holds a local course at launch, it is displayed before the pass begins; only a device with no local course waits for the first pass, so that a returning user is never shown an empty state.

[036] The pass visits record types in dependency order S310 — courses, subjects, chapters, topics, sub-topics, flashcards, study sessions, reminders — so that a child never arrives before its parent. For each type the engine 150 retrieves S320 the records the server has changed since the watermark minus a rewind interval (sixty seconds in the preferred embodiment). Because the server limits each response (to 1,000 rows in the preferred embodiment), retrieval is repeated in pages ordered by identifier until a page returns empty. Re-retrieving records already seen costs nothing because every write is an idempotent upsert keyed on the record identifier, whereas missing one would silently lose data.

[037] Retrieved records are reconciled S330 with local records by identifier: a record absent locally is inserted; a record present locally forms a conflict pair, merged S340 by the rules of Section 9.5. A result taken whole from the server is stored as `synced`; a result combining both copies exists nowhere else and is stored as `pending`. Only after merging does the engine transmit S350 every `pending` record of that type, so that what is transmitted is the reconciled version.

[038] After the last type S360, the watermark is advanced S370 to the latest update time assigned by the server among the records seen — the server's clock, not the device's — and only if the whole pass succeeded; a failed pass is repeated in full. If any record was retrieved, a generation counter is incremented S380 and every screen that displays synchronised data re-reads it. A pass attempted while the device is known to be offline returns quietly without error.

### 9.5 Merge rules (FIG. 4)

[039] For each conflict pair the engine applies, in order:

1. **Deletion 410.** If either copy carries a deletion marker, the result is deleted, with the earlier of the two deletion times 412. Resurrecting a record the user deleted is treated as worse than losing an edit to it.
2. **Records without completion 420.** For a record type with no completion state, the copy with the later update time is kept whole; on an exactly equal update time the local copy is kept 422, so that a device does not rewrite records it already agrees with on every pass.
3. **Completion 430.** For topics and sub-topics, the completion state is resolved on its own: the copy with the later `completed_changed_at` supplies it 432. Where the times are exactly equal, the result is **completed** 434, because silently un-marking finished work is the error a student would least tolerate. Where neither copy has a completion-change time, the result is completed if either copy is.
4. **Other fields 440.** All other fields are taken from the copy with the later update time. The result is written locally and, when it combines the two copies, marked `pending`.

[040] Consequently, a rename made on one device and a completion made on another device to the same topic both survive, which whole-record last-writer-wins cannot achieve, at a fraction of the cost of a general conflict-free replicated data type.

### 9.6 Confirmation-gated generative assistant (FIG. 5)

[041] The assistant is optional and requires connectivity; every other function operates offline. The device transmits the user's question and the names of the user's subjects to the proxy 230, which alone holds the model credential 236. For a question, the instruction composer 238 supplies a system instruction describing a delimited proposal block (in the preferred embodiment, a fenced block labelled `preppilot-proposal` containing a JSON object) and stating that only additions may be proposed. For summaries and quizzes about a single topic, a different instruction is supplied that does not mention proposals, so that such output never carries one.

[042] On receipt 510, the device separates any proposal block from the prose 520; the prose is displayed. The block is validated 530 against a grammar whose only operations are `addChapters` and `addTopics`, each naming a subject and listing chapters and their topics; every name must be a non-empty string within a maximum length. The grammar has no operation for deleting, completing, renaming or reordering anything. A block that fails to parse or validate is discarded 532, so that malformed or manipulated model output produces prose only and can never alter the record. The model is therefore not merely instructed but structurally unable to take a destructive action.

[043] A valid block is stored as an inert proposal attached to the message 540, with a summary of how many chapters and topics it would add; storing it has no effect on the local database. When the user opens the review 550, every chapter and topic that would be added is listed. If the user declines 562 the proposal is discarded. If the user confirms 560, the proposal is checked against a maximum reviewable size 570 (two hundred topics in the preferred embodiment), above which it is refused 572 because confirming hundreds of items is not a meaningful review. Otherwise the additions are written 580 to the subject whose name matches case-insensitively, or to a new subject of that name, and marked `pending` for synchronisation.

### 9.7 Questions accompanied by an image (FIG. 6)

[044] The composer offers to attach an image by capturing a photograph or selecting one from the device's gallery 610. Selection uses the operating system's photo picker, which requires no permission; only capture requests camera permission. The image pre-processor 162 down-scales the image so that its longest side does not exceed a maximum dimension (1,600 pixels in the preferred embodiment), at which printed text remains legible, and re-encodes it as JPEG at reduced quality 620. A multi-megabyte photograph thereby becomes a request of a few hundred kilobytes. The result is encoded as base64 and attached to the question 630; if the user types no question, a default question asking the model to explain the image and answer any question in it is sent.

[045] The request validator 232 accepts only permitted media types (JPEG, PNG, WebP, HEIC/HEIF), requires well-formed base64, and enforces a maximum encoded size (5,000,000 characters in the preferred embodiment) 640. An unsuitable image is rejected with a client error (400 for malformed, 413 for too large) 642 before the model is invoked, so that no model quota is spent on it. The rate limiter 234 then enforces a per-account budget (twenty requests per hour in the preferred embodiment; anonymous requests, where enabled for a demonstration, share one global budget) 650. The composer 238 builds the model request with the image part placed before the text part and with the instruction that mathematics be written in plain text with Unicode symbols rather than a typesetting syntax 660. Summaries and quizzes never carry an image. Upstream error bodies from the model service are never forwarded to the device, since they can contain credential or quota detail.

### 9.8 Presentation of replies

[046] The reply renderer parses the reply's markup into blocks 680 — headings, paragraphs, bulleted and numbered items with nesting, quotations, rules, preformatted code and tables — and inline spans — bold, italic, strikethrough, code and link text — and renders them with the application's own typography, so that no markup symbol is displayed. A table is rendered as rows of cells separated by a middle dot, with the header row in bold, since a phone is too narrow for columns. A character escaped with a backslash is displayed literally and never interpreted as markup. Any construct not recognised is displayed as plain text rather than suppressed.

[047] Mathematical markup that survives the instruction is rewritten as Unicode 690: fractions as a/b (parenthesised where needed), square roots with √, digit superscripts and subscripts as their Unicode forms (x², H₂O), and named symbols as their characters (α, π, ≤, ×, →). Inline mathematics delimited by dollar signs is recognised only where the delimiter is adjacent to non-space content and is not followed by a digit, so that monetary amounts such as "$5 and $10" are left unchanged.

[048] On a device with an on-screen keyboard, the region holding the question field is measured in window coordinates — the coordinate space in which the keyboard's position is reported — and padded by exactly the part the keyboard covers, so that the field remains visible regardless of the status bar, navigation bar or tab bar above and below it.

### 9.9 Credentials and access

[049] The model credential exists only as a secret of the server function and is never returned to any client; the device and the browser build carry only a publishable project key, whose reach is bounded by row-level security 222. Authentication supports e-mail and password with a confirmation link that returns into the application using the PKCE flow, and native sign-in with a Google account whose identity token is verified by the authentication service 210.

### 9.10 Working example

[050] **Example 1 — Progress.** A student imports the JEE Main 2026 template (3 subjects, 55 chapters, 605 topics) and marks 25 topics complete. The Tracker reports 4.13 % overall and 20.8 % for Mathematics, computed from units as described; Physics and Chemistry, where nothing is done, report 0 %. (Annexure, A1 and A2.)

[051] **Example 2 — Synchronisation.** A student marks topics complete on a phone, uninstalls the application, reinstalls it and signs in. The session scheduler triggers a pass on sign-in; the pages of topic records are retrieved and merged, and the completions are restored without user action. In testing on a physical device in September 2026 the courses, topic completions, flashcards and study sessions were restored.

[052] **Example 3 — Proposal.** Asked "My Science subject is missing electricity. Suggest a chapter with its topics that I should add.", the model returned prose and a proposal adding one chapter, "Electricity", with six topics. The review listed all six; nothing was written until "Add to tracker" was pressed. (Annexure, A10.)

[053] **Example 4 — Image.** A photograph of a printed exercise containing three questions on electricity was attached with the question "Solve Q2 and Q3 from this page." The image was reduced on the device, validated by the server, and answered by the model; the reply was displayed with headings, nested bullets, bold answers and Unicode notation (R₁, 1/R_eq, 10 Ω) and without any markup symbol. (Annexure, A11 and A12.)

[054] **Verification.** The prototype is covered by 1,934 automated tests in 91 suites, including tests that assert averaging is not used, that an empty scope is unmeasured, that a rename on one copy and a completion on the other both survive a merge, that pushing does not precede merging, that a proposal to delete parses to nothing, and that unsuitable images are rejected before any model call.

### 9.11 Advantages

[055] The invention (a) reports progress that reflects work actually done; (b) remains fully usable without connectivity; (c) never loses a completion to an unrelated edit and never resurrects a deletion; (d) does not skip records because of clock differences or truncated responses; (e) allows a generative model to contribute to the user's record while making unconfirmed or destructive changes impossible by construction; (f) reduces data transmitted and model quota consumed for image questions and rejects unsuitable images at no model cost; (g) makes model replies legible on a small screen; and (h) keeps the model credential off every device.

### 9.12 Alternative embodiments

[056] The hierarchy may have more or fewer levels and may represent any checklist whose completion is measured, such as a training curriculum or an inspection checklist. The local database may be any embedded store supporting keyed upserts; the cloud database any store supporting per-user access control. The rewind interval, page size, interval between passes, maximum image dimension, size limit and maximum reviewable proposal size are parameters. The proposal grammar may include further additive operations, such as adding sub-topics or flashcards, while excluding destructive ones. The model may be any generative model reachable by the server, and the device may run any operating system.

## 10. Claims

We claim:

1. A computer-implemented method for maintaining progress through a hierarchical study plan across a plurality of user devices, the method comprising:
   (a) storing, in a local relational database of a first user device, the study plan as records comprising subjects, chapters of each subject and topics of each chapter, each record carrying a device-generated identifier, an update time and a deletion marker, and each topic record additionally carrying a completion state and a completion-change time that is maintained separately from the update time of that topic record;
   (b) completing each create, update, completion-change and delete operation against the local relational database independently of network availability, marking each affected record as pending, and effecting each delete operation by setting the deletion marker of the record;
   (c) upon a synchronisation trigger, for each record type in an order in which a parent type precedes its child types: retrieving from a server the records changed since a watermark; reconciling the retrieved records with local records by identifier; merging each pair of a local record and a retrieved record having the same identifier according to rules under which (i) a record carrying a deletion marker in either copy is resolved as deleted, (ii) the completion state of a topic record is taken from the copy having the later completion-change time irrespective of which copy has the later update time, and (iii) the remaining fields are taken from the copy having the later update time; storing a merged record that combines fields of both copies as pending; and, only after said merging, transmitting to the server every record of that type marked as pending; and
   (d) advancing the watermark to the latest server-assigned update time among the retrieved records only upon successful completion of the synchronisation pass for all record types.

2. The method as claimed in claim 1, wherein, where the completion-change times of the two copies of a topic record are equal, the completion state is resolved as completed.

3. The method as claimed in claim 1, wherein, where both copies carry a deletion marker, the earlier deletion time is retained, and wherein, where the update times of two copies of a record having no completion state are equal, the local copy is retained without being rewritten.

4. The method as claimed in claim 1, wherein the retrieving comprises requesting records changed since the watermark less a predetermined rewind interval, and requesting successive pages of records ordered by identifier until a page containing no records is returned.

5. The method as claimed in claim 1, wherein the synchronisation trigger is any one of: authentication of a user on the device; expiry of a periodic interval while the application is in the foreground; the application leaving the foreground; and a transition of the device from lacking to having network connectivity.

6. The method as claimed in claim 1, further comprising, upon launch of the application, displaying the study plan from the local relational database before a first synchronisation pass completes where the local relational database holds a study plan, and awaiting the first synchronisation pass only where it holds none.

7. The method as claimed in claim 1, further comprising computing, upon each read and without storing the result, a progress value for any scope of the study plan as the number of completed units divided by the number of units within the scope, a unit being a topic that has no sub-topics or each sub-topic of a topic that has sub-topics, and returning an unmeasured indication, distinct from zero, for a scope containing no units.

8. The method as claimed in claim 7, wherein the displayed progress value is not presented as complete while any unit within the scope is incomplete, and is not presented as zero while any unit within the scope is complete.

9. The method as claimed in claim 1, wherein the device-generated identifier is a time-ordered universally unique identifier, and wherein the server permits a client to remove no record other than by setting its deletion marker.

10. A computer-implemented method for modifying a hierarchical study plan held on a user device using a generative language model, the method comprising:
    (a) transmitting a query from the user device to a server-side proxy that holds a credential for the generative language model and that supplies to the model an instruction describing a delimited proposal format;
    (b) receiving a reply from the model via the proxy and separating from the reply any delimited proposal block, the remainder of the reply being displayed;
    (c) validating the proposal block against a grammar whose only operations add chapters or topics to a named subject, and discarding any proposal block that does not conform, whereby a non-conforming reply is incapable of altering the study plan;
    (d) storing a conforming proposal block as an inert proposal that effects no change to the study plan;
    (e) presenting to the user each chapter and topic that the proposal would add; and
    (f) only upon an explicit confirmation by the user, writing the chapters and topics of the proposal to the study plan on the user device.

11. The method as claimed in claim 10, wherein the grammar contains no operation for deleting, completing, renaming or reordering any part of the study plan.

12. The method as claimed in claim 10, wherein the writing is refused where the number of topics in the proposal exceeds a predetermined maximum reviewable number, and wherein the chapters and topics are written to the subject whose name matches the named subject without regard to letter case, or to a newly created subject of that name where none matches.

13. The method as claimed in claim 10, wherein, for a request to summarise or to test the user on a single topic, the proxy supplies an instruction that omits the proposal format.

14. The method as claimed in claim 10, further comprising:
    (a) acquiring an image on the user device by capture or selection, reducing the image so that its longest side does not exceed a predetermined dimension, re-encoding it in a lossy format, and transmitting it with the query;
    (b) at the proxy, validating the media type, the encoding and the size of the image and, where the image fails validation, rejecting the query without invoking the generative language model; and
    (c) at the proxy, composing a model request in which the image precedes the text of the query.

15. The method as claimed in claim 14, wherein, where the query transmitted with the image contains no text entered by the user, a predetermined question requesting an explanation of the image is transmitted as the query.

16. The method as claimed in claim 10 or claim 14, further comprising, at the user device, parsing markup in the displayed reply into styled blocks and inline spans such that no markup symbol is displayed, and rewriting mathematical markup in the reply as Unicode characters, inline mathematics delimited by a currency-like delimiter being recognised only where the delimiter is adjacent to non-space content and is not followed by a digit.

17. The method as claimed in claim 14, wherein the proxy applies a per-account limit on the number of requests before invoking the generative language model, and supplies an instruction that mathematical expressions be written in plain text.

18. A system comprising a user device having a processor, a display, and a memory holding a local relational database and instructions, and a server having a database and a proxy, the user device and the server being configured together to perform the method as claimed in any one of claims 1 to 17.

19. The system as claimed in claim 18, wherein the user device positions a region containing a query input field by measuring the region in window coordinates and padding it by the portion of the region overlapped by an on-screen keyboard.

20. A non-transitory computer-readable medium storing instructions which, when executed by one or more processors, cause the processors to perform the method as claimed in any one of claims 1 to 17.

&nbsp;

Dated this ____ day of ______________, 2026

Signature: ______________________________ (Applicant / Agent for the Applicant)

## 11. Abstract

A system and method for tracking progress through a hierarchical study plan (subjects, chapters, topics, optional sub-topics) on a mobile device (100) whose local database (130) is authoritative, so that every action completes offline. Progress is computed on read as completed units over total units, with an unmeasured state for empty scopes. Copies on several devices are synchronised (FIG. 3) by pulling in pages since a rewound server-clock watermark, merging before pushing, and advancing the watermark only on success; merge rules (FIG. 4) let deletions prevail and resolve topic completion by its own change time, ties resolving to completed. A generative model (300), reached only through a server proxy (230) holding its credential, may alter the plan solely through an additive-only proposal grammar held as an inert object and applied on the user's confirmation (FIG. 5). Images are reduced on the device, validated before any model call, and replies are rendered with mathematics rewritten as Unicode (FIG. 6).

_(Figure to accompany the abstract: FIG. 1)_

<!-- pagebreak -->

# Drawings

![FIG. 1 — System block diagram](figures/fig1-system.png 'w=15')

<!-- pagebreak -->

![FIG. 2 — Hierarchical record and topic-weighted progress](figures/fig2-progress.png 'w=15')

<!-- pagebreak -->

![FIG. 3 — One synchronisation pass](figures/fig3-sync.png 'w=15')

<!-- pagebreak -->

![FIG. 4 — Merge rules for two copies of a record](figures/fig4-merge.png 'w=15')

<!-- pagebreak -->

![FIG. 5 — Confirmation-gated handling of a model reply](figures/fig5-proposal.png 'w=15')

<!-- pagebreak -->

![FIG. 6 — A question accompanied by an image](figures/fig6-image.png 'w=15')

<!-- pagebreak -->

# Part C — Notes for the Patent Professional

_This part is not part of the specification. It records what the proposed inventors know, and what they do not, so that the University's IPR cell and the patent agent can decide how to proceed._

## C.1 Patentable subject matter

Section 3(k) of the Patents Act, 1970 excludes "a mathematical or business method or a computer programme per se or algorithms". Under the Indian Patent Office's guidelines for computer-related inventions, a claim that is in substance a program or an algorithm is refused, while one that produces a technical effect or technical contribution may be allowed. The claims in Part B have been framed around technical effects — data is not lost between replicated databases, records are not skipped because of clock skew or truncated responses, a generative model is prevented by construction from issuing destructive operations, and bandwidth and third-party compute are saved by rejecting unsuitable images before invoking the model. Whether these framings satisfy the current guidelines is a matter for the agent. Claims 7 and 8 (progress arithmetic) are the most exposed to a 3(k) objection and are drafted as dependent claims for that reason.

## C.2 Prior-art search (not yet performed)

No patent or non-patent prior-art search has been carried out; the "new" elements in A.3 reflect only the inventors' review of well-known applications (Anki, Quizlet, Todoist, Forest, coaching portals) and of the academic literature cited in the Background. Individually, several building blocks are known — last-writer-wins, tombstones, watermarks, spaced repetition, LLM assistants, client-side image compression. Novelty and inventive step will most likely rest on the specific combinations in claims 1 and 10. Suggested searches:

- **Databases:** InPASS (Indian Patent Office), Google Patents, WIPO PATENTSCOPE, Espacenet.
- **CPC classes:** G06F 16/27 (replication and synchronisation of databases), G06F 16/178 (synchronisation of replicated files), G09B 5/00 and G09B 7/00 (electrically operated educational appliances), G06N 3/0475 and G06N 20/00 (generative and machine-learning models), G06Q 50/20 (education services).
- **Keywords:** "offline first" synchronisation conflict "completion timestamp"; "last writer wins" tombstone hierarchical checklist; "large language model" proposal confirmation "structured output" whitelist operations; "LLM" "human in the loop" "user confirmation" modify data; syllabus progress weighted topic.

## C.3 Disclosure and timing — urgent

India does not provide a general grace period for an inventor's own disclosure; the exceptions in Sections 29 to 34 of the Act are narrow. The web demonstration at `preppilottdemo.netlify.app` is **publicly reachable**. The version deployed there runs in demo mode without synchronisation and includes the assistant with the proposal-and-confirmation flow; the image feature and the current synchronisation triggers are not yet deployed there, and the updated web build should **not** be uploaded before filing. It is recommended that the agent be consulted immediately on whether to take the demonstration offline or restrict it until filing, and that a **provisional specification** be filed as soon as possible to secure a priority date, with the complete specification following within twelve months. Further presentations, report submissions and publications should wait until after filing.

## C.4 Inventorship and the use of AI tools

Only natural persons who contributed to the conception of the subject matter of at least one claim can be named as inventors. The project records who proposed which design decision in `DECISIONS.md` and in the repository history; the agent should use these to settle inventorship, including whether the supervisor contributed to conception. Software development tools, including AI coding assistants used during implementation, cannot be named as inventors; the agent should confirm that each claimed feature was conceived by the named persons.

## C.5 Forms and formalities (to be confirmed with the agent)

- **Form 1** — application for grant of patent (with inventor declarations).
- **Form 2** — provisional or complete specification (this Part B).
- **Form 3** — statement and undertaking regarding foreign applications.
- **Form 5** — declaration as to inventorship (with the complete specification).
- **Form 26** — authorisation of a patent agent, where one is appointed.
- **Form 28** — where the applicant claims a category eligible for reduced fees (for example an educational institution); eligibility and fees to be verified at the time of filing.
- **Form 9** — request for early publication, and **Form 18 / 18A** — request for examination (expedited examination is available to some applicant categories), at the agent's discretion.

## C.6 Formal drawings

FIG. 1 to FIG. 6 are black-and-white line drawings with reference numerals, prepared for this draft. The agent's draughtsperson should check them against the drawing requirements of the Patents Rules (sheet size, margins, numbering) before filing. The colour screenshots in the Annexure are illustrations for the reader of this proposal and are not intended to be filed as drawings.

## C.7 Where the evidence lives

| Evidence                                   | Location in the repository                                             |
| :----------------------------------------- | :--------------------------------------------------------------------- |
| Merge rules                                | `packages/shared/src/sync/merge.ts` and its tests                      |
| Synchronisation pass                       | `apps/mobile/src/features/sync/sync-engine.ts`                         |
| Triggers and local-first launch            | `apps/mobile/src/features/sync/sync-session.ts`, `auto-sync.ts`        |
| Paged retrieval                            | `apps/mobile/src/features/sync/supabase-remote.ts`                     |
| Progress arithmetic                        | `packages/shared/src/progress/`                                        |
| Proposal grammar and parsing               | `packages/shared/src/ai/proposal.ts`                                   |
| Proposal review and application            | `apps/mobile/src/features/ai/ai-store.ts`, `ai-screen.tsx`             |
| Image reduction                            | `apps/mobile/src/features/ai/attach-image.ts`                          |
| Server validation, rate limit, instruction | `supabase/functions/ask-gemini/index.ts`                               |
| Reply rendering and maths rewriting        | `apps/mobile/src/features/ai/markdown.ts`, `components/rich-reply.tsx` |
| Row-level security, no delete policy       | `supabase/migrations/`                                                 |
| Dated design decisions                     | `DECISIONS.md`                                                         |

<!-- pagebreak -->

# Annexure — Screens of the Working Prototype

_Illustrative only; not formal drawings. Captured on 24 September 2026 from the prototype's browser build at phone size._

![A1 — Tracker with topic-weighted progress](../assets/screenshots/app/tracker.png 'w=4.4') ![A2 — Topics being marked complete](../assets/screenshots/app/subject-detail.png 'w=4.4') ![A3 — Bundled syllabus templates](../assets/screenshots/app/templates.png 'w=4.4')

![A4 — Building a course from scratch](../assets/screenshots/app/build-from-scratch.png 'w=4.4') ![A5 — Study timer](../assets/screenshots/app/timer.png 'w=4.4') ![A6 — Dashboard computed from the same progress engine](../assets/screenshots/app/dashboard.png 'w=4.4')

![A7 — Flashcard review with fixed intervals](../assets/screenshots/app/flashcard-review.png 'w=4.4') ![A8 — Focus Mode stating its platform limits](../assets/screenshots/app/focus.png 'w=4.4') ![A9 — Formatted reply with no markup symbols](../assets/screenshots/app/assistant-formatted-reply.png 'w=4.4')

![A10 — Proposal review: nothing changes until confirmed](../assets/screenshots/app/assistant-proposal-review.png 'w=4.4') ![A11 — Picture attached to a question](../assets/screenshots/app/assistant-picture-attached.png 'w=4.4') ![A12 — Answer read from the picture, maths as Unicode](../assets/screenshots/app/assistant-picture-reply.png 'w=4.4')

<div align="center">

**— End of draft —**

PrepPilot · Department of Computer Science & Engineering · Vidya University, Meerut · September 2026

</div>
