import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { courseEnrollmentProof } from '../lib/course-enrollment-proof.ts';
const input = { workshopId: '4dde6a07-0a8b-4bf3-b7c5-d02ef0525ad1', courseId: '6ac5016cd2ad4c0041bf44fc', expectedAmount: 199900, requestedAmount: 199900, mobile: '9876543210', name: 'Course Buyer', email: 'BUYER@example.com' };
test('registration checkout generates a compact signed course and buyer reference', () => {
 const notes = courseEnrollmentProof(input, 'test-secret');
 assert.equal(notes.mfw_course_signature, createHmac('sha256','test-secret').update(notes.mfw_course).digest('hex'));
 assert.ok(notes.mfw_course.length <= 250);
 assert.deepEqual(JSON.parse(Buffer.from(notes.mfw_course,'base64url').toString()), { w: input.workshopId, c: input.courseId, a: input.expectedAmount, m: input.mobile });
});
test('underpayment, invalid account identifiers and missing secret cannot create proof', () => {
 for (const patch of [{ requestedAmount: 100 }, {mobile: '123'}, {courseId:'invalid'}]) assert.throws(() => courseEnrollmentProof({...input,...patch},'test-secret'));
 assert.throws(() => courseEnrollmentProof(input,''));
});
