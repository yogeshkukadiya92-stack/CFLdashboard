import { createHmac } from 'node:crypto';
export function courseEnrollmentProof(input: { workshopId: string; courseId: string; expectedAmount: number; requestedAmount: number; mobile: string; name: string; email: string }, secret: string) {
  if (!secret || !/^[a-f0-9]{24}$/i.test(input.courseId) || !/^[a-zA-Z0-9_-]+$/.test(input.workshopId) || !/^[6-9]\d{9}$/.test(input.mobile) || !Number.isSafeInteger(input.expectedAmount) || input.expectedAmount <= 0 || input.requestedAmount !== input.expectedAmount) throw new Error('A valid buyer and full course payment are required.');
  const proof = Buffer.from(JSON.stringify({ w: input.workshopId, c: input.courseId, a: input.expectedAmount, m: input.mobile })).toString('base64url');
  if (proof.length > 250) throw new Error('Course reference is too long.');
  return { mfw_course: proof, mfw_course_signature: createHmac('sha256', secret).update(proof).digest('hex'), mfw_name: input.name.slice(0,100), mfw_email: input.email.trim().toLowerCase().slice(0,200) };
}
