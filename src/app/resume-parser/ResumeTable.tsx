import { Fragment } from "react";
// import type { Resume } from "../lib/redux/types";
import { initialEducation, initialWorkExperience } from "../lib/redux/resumeSlice";
import { deepClone } from "../lib/deep-clone";
import { cx } from "../lib/cx";

 // Define minimal types locally to avoid circular deps
 type Resume = {
   profile?: {
     name?: string;
     firstName?: string;
     middleName?: string;
     lastName?: string;
     email?: string;
     phone?: string;
     location?: string;
     age?: string;
     gender?: string;
     url?: string;
     summary?: string;
   };
   educations?: Array<any>;
   workExperiences?: Array<any>;
   projects?: Array<any>;
   skills?: {
     featuredSkills?: Array<any>;
     descriptions?: Array<string>;
   };
 };

 // Simple utility function
 const cx = (...classes: (string | boolean | undefined)[]) => 
   classes.filter(Boolean).join(' ');


const TableRowHeader = ({ children }: { children: React.ReactNode }) => (
  <tr>
    <th className="px-3 py-2 font-semibold" scope="colgroup" colSpan={2}>
      {children}
    </th>
  </tr>
);

const TableRow = ({
  label,
  value,
  fieldKey,
  onFieldChange,
  className,
}: {
  label: string;
  value: string | string[];
  fieldKey: string;
  onFieldChange?: (field: string, value: string) => void;
  className?: string | false;
}) => (
  <tr className={cx(className)}>
    <th className="px-3 py-2 font-medium" scope="row">
      {label}
    </th>
    <td className="px-3 py-2">
      {typeof value === "string" ? (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onFieldChange?.(fieldKey, e.target.value)}
          className="border px-2 py-1 rounded w-full"
        />
      ) : (
        <textarea
          value={Array.isArray(value) ? value.join("\n") : ""}
          onChange={(e) => onFieldChange?.(fieldKey, e.target.value)}
          className="border px-2 py-1 rounded w-full"
          rows={Math.max(3, Array.isArray(value) ? value.length : 3)}
        />
      )}
    </td>
  </tr>
);

const splitFullName = (fullName: string) => {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : "",
    lastName: parts.length > 1 ? parts[parts.length - 1] : "",
  };
};

export const ResumeTable = ({
  resume,
  onFieldChange,
}: {
  resume: Resume;
  onFieldChange?: (field: string, value: string) => void;
}) => {
  console.log("DEBUG ResumeTable render resume:", resume);
  // -------------------------
  // Create safe local copies
  // -------------------------
  const profile = resume?.profile ?? {};
  const profileName = typeof profile.name === "string" ? profile.name : "";
  const { firstName, middleName, lastName } = splitFullName(profileName);

  const safeProfile = {
    name: profileName,
    firstName: profile.firstName || firstName,
    middleName: profile.middleName || middleName,
    lastName: profile.lastName || lastName,
    email: profile.email || "",
    phone: profile.phone || "",
    location: profile.location || "",
    age: profile.age || "",
    gender: profile.gender || "",
    url: profile.url || "",
    summary: profile.summary || "",
  };

  const educations = Array.isArray(resume?.educations) && resume.educations.length > 0
    ? resume.educations
    : [deepClone(initialEducation)];

  const workExperiences = Array.isArray(resume?.workExperiences) && resume.workExperiences.length > 0
    ? resume.workExperiences
    : [deepClone(initialWorkExperience)];

  const projects = Array.isArray(resume?.projects) ? resume.projects : [];

  // Skills: be tolerant of formats (array of strings, or array of objects with .skill)
  const skillsObj = resume?.skills ?? { featuredSkills: [], descriptions: [] };

  const skillsArr = Array.isArray(skillsObj.featuredSkills) ? skillsObj.featuredSkills : [];
  const skillsDescriptions = Array.isArray(skillsObj.descriptions) ? [...skillsObj.descriptions] : [];

  const featuredSkills = skillsArr
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string") return item;
      if (typeof item === "object" && item.skill) return String(item.skill);
      return "";
    })
    .filter(Boolean)
    .join(", ")
    .trim();

  if (featuredSkills) {
    // put featured skills as first item in the descriptions shown in the table
    // do not mutate original resume; we work with a local copy
    skillsDescriptions.unshift(featuredSkills);
  }

  // -------------------------
  // Render
  // -------------------------
  return (
    <table className="resume-parsing-table">
      <tbody className="text-left align-top">
        <TableRowHeader>Profile</TableRowHeader>
        <TableRow
          label="First Name"
          value={safeProfile.firstName}
          fieldKey="profile.firstName"
          onFieldChange={onFieldChange}
        />
        <TableRow
          label="Middle Name"
          value={safeProfile.middleName}
          fieldKey="profile.middleName"
          onFieldChange={onFieldChange}
        />
        <TableRow
          label="Last Name"
          value={safeProfile.lastName}
          fieldKey="profile.lastName"
          onFieldChange={onFieldChange}
        />
        <TableRow
          label="Age"
          value={safeProfile.age}
          fieldKey="profile.age"
          onFieldChange={onFieldChange}
        />
        <TableRow
          label="Gender"
          value={safeProfile.gender}
          fieldKey="profile.gender"
          onFieldChange={onFieldChange}
        />
        <TableRow
          label="Email"
          value={safeProfile.email}
          fieldKey="profile.email"
          onFieldChange={onFieldChange}
        />
        <TableRow
          label="Phone"
          value={safeProfile.phone}
          fieldKey="profile.phone"
          onFieldChange={onFieldChange}
        />
        <TableRow
          label="Location"
          value={safeProfile.location}
          fieldKey="profile.location"
          onFieldChange={onFieldChange}
        />
        <TableRow
          label="Link"
          value={safeProfile.url}
          fieldKey="profile.url"
          onFieldChange={onFieldChange}
        />
        <TableRow
          label="Summary"
          value={safeProfile.summary}
          fieldKey="profile.summary"
          onFieldChange={onFieldChange}
        />

        <TableRowHeader>Education</TableRowHeader>
        {educations.map((education, idx) => (
          <Fragment key={idx}>
            <TableRow
              label="School"
              value={education?.school || ""}
              fieldKey={`educations.${idx}.school`}
              onFieldChange={onFieldChange}
            />
            <TableRow
              label="Degree"
              value={education?.degree || ""}
              fieldKey={`educations.${idx}.degree`}
              onFieldChange={onFieldChange}
            />
            <TableRow
              label="GPA"
              value={education?.gpa || ""}
              fieldKey={`educations.${idx}.gpa`}
              onFieldChange={onFieldChange}
            />
            <TableRow
              label="Date"
              value={education?.date || ""}
              fieldKey={`educations.${idx}.date`}
              onFieldChange={onFieldChange}
            />
            <TableRow
              label="Descriptions"
              value={Array.isArray(education?.descriptions) ? education.descriptions : []}
              fieldKey={`educations.${idx}.descriptions`}
              onFieldChange={onFieldChange}
            />
          </Fragment>
        ))}

        <TableRowHeader>Work Experience</TableRowHeader>
        {workExperiences.map((workExperience, idx) => (
          <Fragment key={idx}>
            <TableRow
              label="Company"
              value={workExperience?.company || ""}
              fieldKey={`workExperiences.${idx}.company`}
              onFieldChange={onFieldChange}
            />
            <TableRow
              label="Job Title"
              value={workExperience?.jobTitle || workExperience?.position || ""}
              fieldKey={`workExperiences.${idx}.jobTitle`}
              onFieldChange={onFieldChange}
            />
            <TableRow
              label="Date"
              value={workExperience?.date || ""}
              fieldKey={`workExperiences.${idx}.date`}
              onFieldChange={onFieldChange}
            />
            <TableRow
              label="Descriptions"
              value={Array.isArray(workExperience?.descriptions) ? workExperience.descriptions : []}
              fieldKey={`workExperiences.${idx}.descriptions`}
              onFieldChange={onFieldChange}
            />
          </Fragment>
        ))}

        {projects.length > 0 && <TableRowHeader>Projects</TableRowHeader>}
        {projects.map((project, idx) => (
          <Fragment key={idx}>
            <TableRow
              label="Project"
              value={project?.project || project?.name || ""}
              fieldKey={`projects.${idx}.project`}
              onFieldChange={onFieldChange}
            />
            <TableRow
              label="Date"
              value={project?.date || ""}
              fieldKey={`projects.${idx}.date`}
              onFieldChange={onFieldChange}
            />
            <TableRow
              label="Descriptions"
              value={Array.isArray(project?.descriptions) ? project.descriptions : []}
              fieldKey={`projects.${idx}.descriptions`}
              onFieldChange={onFieldChange}
            />
          </Fragment>
        ))}

        <TableRowHeader>Skills</TableRowHeader>
        <TableRow
          label="Descriptions"
          value={skillsDescriptions}
          fieldKey="skills.descriptions"
          onFieldChange={onFieldChange}
        />
      </tbody>
    </table>
  );
};
