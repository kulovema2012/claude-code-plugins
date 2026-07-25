# Manual format and quality standard

## Contents

1. Default deliverable
2. Document structure
3. Step pattern
4. Thai localization
5. Visual and accessibility rules
6. Final inspection

## Default deliverable

Create DOCX unless the user requests PDF, Markdown, HTML, a knowledge-base page, or another format. Use the available document-creation capability and follow its instructions. Open and render the result for visual inspection.

Use a clean, neutral training-manual design. Apply supplied brand colors, logo, and typography only when the user provides or approves them.

## Document structure

Use this order unless the requested format requires otherwise:

1. Title page
2. Document purpose and intended audience
3. Version, platform, role, language, and observation date
4. Prerequisites
5. Privacy and account-safety note
6. Process overview or table of contents
7. Numbered procedures with annotated screenshots
8. Expected completion state
9. Troubleshooting and recovery
10. Completion checklist

Do not place actual account identities, credentials, tokens, private URLs, or customer data on the title or metadata pages.

## Step pattern

For every procedure:

```text
ขั้นตอนที่ N: [ผลลัพธ์ที่ผู้ใช้ต้องการ]

สิ่งที่ต้องทำ
1. [การกระทำที่ตรงกับหมายเลข 1 ในภาพ]
2. [การกระทำที่ตรงกับหมายเลข 2 ในภาพ]

[ภาพหน้าจอพร้อมคำอธิบายภาพ]

ผลลัพธ์ที่ควรเห็น
[สถานะที่ตรวจสอบได้]

หากไม่สำเร็จ
[วิธีแก้ปัญหาที่สั้นและเฉพาะเจาะจง]
```

Place the screenshot close to its instructions. Do not separate a screenshot from its marker legend across pages when avoidable.

## Thai localization

Default to natural Thai written for complete beginners. Prefer short active sentences and one action per instruction.

- Switch the app UI to Thai when the app supports it and doing so does not alter the user's account unexpectedly.
- Preserve displayed UI labels exactly.
- If the UI is not Thai, quote the original label and add a concise Thai explanation.
- Keep product names and established technical terms unchanged where translation would reduce recognition.
- Use one Thai term consistently for each concept.
- Use a Thai-capable font such as Sarabun, Noto Sans Thai, Leelawadee UI, or another available equivalent.
- Verify Thai line breaks, tone marks, numerals, captions, table cells, headers, and exported PDF glyphs.

## Visual and accessibility rules

- Use heading hierarchy and automatic numbering.
- Add useful alt text that describes the action and target without including sensitive data.
- Do not rely on color alone; pair color with numbers, shapes, or text.
- Maintain readable contrast and marker size.
- Keep screenshots legible at normal zoom.
- Crop only irrelevant outer space; never crop out context needed to orient the user.
- Use consistent captions such as `รูปที่ 3 หน้าจอสร้างโครงการ`.

## Final inspection

Open the final document and inspect every page. Confirm:

- no clipped or stretched screenshots;
- no orphaned headings or separated legends;
- working table of contents and links;
- correct page breaks, numbering, and captions;
- correctly rendered Thai;
- no sensitive information in text, images, headers, footers, comments, alt text, properties, or revision metadata;
- all steps match the approved journey and current UI;
- the completion checklist matches the demonstrated success state.
