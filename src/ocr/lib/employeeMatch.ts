import { normalizeString } from './stringUtils';

export interface EmployeeMatch {
  employeeid: number;
  name: string;
  department: string;
  position: string;
  confidence: number; // 0-100
  matchReason: string[];
}

export interface MatchingCriteria {
  employeeName?: string;
  employeeId?: string;
  email?: string;
  phone?: string;
}

export async function findEmployeeMatches(
  criteria: MatchingCriteria,
  allEmployees: any[] = []
): Promise<EmployeeMatch[]> {
  if (!allEmployees || allEmployees.length === 0) {
    const employees = await window.employeeAPI?.getEmployees?.();
    allEmployees = employees || [];
  }

  const matches: EmployeeMatch[] = [];

  for (const emp of allEmployees) {
    const { employeeid, name = "", firstname = "", lastname = "", middlename = "", email = "", contact = "" } = emp;
    let confidence = 0;
    const matchReason: string[] = [];

    // Build full name variants
    const empFullName = name || `${firstname || ""} ${middlename || ""} ${lastname || ""}`.trim();
    const empFirstLast = `${firstname || ""} ${lastname || ""}`.trim();
    const empLastFirst = `${lastname || ""}, ${firstname || ""}`.trim();

    // 1. Exact/fuzzy ID match (highest priority)
    if (criteria.employeeId) {
      const criteriaId = String(criteria.employeeId).trim();
      const empId = String(employeeid).trim();
      
      if (criteriaId === empId) {
        confidence += 100;
        matchReason.push(`ID match: ${empId}`);
      } else if (criteriaId.includes(empId) || empId.includes(criteriaId)) {
        confidence += 50;
        matchReason.push(`Partial ID match`);
      }
    }

    // 2. Name matching (multiple variants for flexibility)
    if (criteria.employeeName) {
      const normalizedCriteria = normalizeString(criteria.employeeName);
      const normalizedFull = normalizeString(empFullName);
      const normalizedFirstLast = normalizeString(empFirstLast);
      const normalizedLastFirst = normalizeString(empLastFirst);

      if (normalizedCriteria === normalizedFull || normalizedCriteria === normalizedFirstLast) {
        confidence += 90;
        matchReason.push(`Exact name match`);
      } else if (normalizedCriteria === normalizedLastFirst) {
        confidence += 85;
        matchReason.push(`Name match (Last, First format)`);
      } else if (
        normalizeString(criteria.employeeName).split(/\s+/).every(word =>
          normalizedFull.includes(word)
        )
      ) {
        confidence += 70;
        matchReason.push(`All name parts found`);
      } else if (levenshteinSimilarity(normalizedCriteria, normalizedFull) > 0.8) {
        confidence += 60;
        matchReason.push(`Similar name (fuzzy match)`);
      }
    }

    // 3. Email match
    if (criteria.email && email) {
      if (normalizeString(criteria.email) === normalizeString(email)) {
        confidence += 95;
        matchReason.push(`Email match`);
      }
    }

    // 4. Phone match
    if (criteria.phone && contact) {
      const cleanPhone = criteria.phone.replace(/\D/g, '');
      const empPhone = contact.replace(/\D/g, '');
      if (cleanPhone && empPhone && cleanPhone === empPhone) {
        confidence += 95;
        matchReason.push(`Phone match`);
      }
    }

    if (confidence > 0) {
      matches.push({
        employeeid,
        name: empFullName,
        department: emp.department || "N/A",
        position: emp.position || "N/A",
        confidence: Math.min(confidence, 100),
        matchReason
      });
    }
  }

  // Sort by confidence (descending)
  return matches.sort((a, b) => b.confidence - a.confidence);
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function extractEmployeeDataFromOCR(extractedTexts: any[]): MatchingCriteria {
  const criteria: MatchingCriteria = {};
  const texts = extractedTexts.map(item => String(item.text || "").trim()).join(" ");

  // Try to extract ID (common patterns: "ID: 12345" or "EMP-12345")
  const idMatch = texts.match(/(?:ID|EMP|#)[\s:]*(\d{4,6})/i);
  if (idMatch) {
    criteria.employeeId = idMatch[1];
  }

  // Try to extract email
  const emailMatch = texts.match(/[\w\.-]+@[\w\.-]+\.\w+/);
  if (emailMatch) {
    criteria.email = emailMatch[0];
  }

  // Try to extract phone
  const phoneMatch = texts.match(/[\+]?[(]?[0-9]{3}[)\.]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/);
  if (phoneMatch) {
    criteria.phone = phoneMatch[0];
  }

  // Extract potential name (usually first meaningful text)
  const nameMatch = texts.match(/^([A-Z][a-z]+ (?:[A-Z][a-z]+ )*[A-Z][a-z]+)/);
  if (nameMatch) {
    criteria.employeeName = nameMatch[1];
  }

  return criteria;
}