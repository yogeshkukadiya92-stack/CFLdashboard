# Course enrollment settings

Open Settings → Course Enrollment. The MFW connection uses the existing server environment `MFW_API_BASE_URL` and `MFW_INTEGRATION_API_KEY`. The integration key must have `courses:write`. If no environment key is configured, the page can securely save a server-side key in its private encrypted connection table.

Choose the existing paid CFL registration link, select the corresponding MFW course, and enable automatic assignment. Save synchronizes the course mapping and existing `RAZORPAY_WEBHOOK_SECRET` with MFW. Nothing is assigned at registration time: successful full payment is required.

The Razorpay webhook destination is `/api/webhooks/razorpay`, with `order.paid` for registration checkout and `payment_link.paid` for separately mapped Razorpay Payment Links. Existing payment and workflow automation remains intact. Missing or invalid signatures, partial payments, and ambiguous buyer accounts do not grant courses. Failed MFW delivery returns 503 to allow Razorpay retries.

The registration checkout stores a compact signed course reference in order notes. The amount comes from the server's published registration fee. A client cannot set its own course ID or enrollment signature. Existing unmapped workshop checkout is unchanged.

Only admin sessions can read or save enrollment settings. Keys and signing secrets are not returned to the browser. A configured connection and a configured webhook secret are reported separately from a proven live payment delivery.
