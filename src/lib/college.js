export const COLLEGE_EMAIL_DOMAIN = 'jecrcu.edu.in'

const COLLEGE_EMAIL_PATTERN = /^[a-z0-9._%+-]+@jecrcu\.edu\.in$/i

export function isCollegeEmail(email) {
  return COLLEGE_EMAIL_PATTERN.test(String(email || '').trim())
}

export function collegeEmailError() {
  return `Use your college email (@${COLLEGE_EMAIL_DOMAIN}).`
}
