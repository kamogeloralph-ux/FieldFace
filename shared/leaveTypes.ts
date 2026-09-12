export const LEAVE_TYPES = [
  { value: "annual", label: "Annual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "family_responsibility", label: "Family responsibility leave" },
  { value: "maternity", label: "Maternity leave" },
  { value: "parental", label: "Parental leave" },
  { value: "adoption", label: "Adoption leave" },
  { value: "commissioning_parental", label: "Commissioning parental leave" },
  { value: "study", label: "Study leave" },
  { value: "unpaid", label: "Unpaid leave" },
  { value: "compassionate", label: "Compassionate leave" },
  { value: "religious", label: "Religious observance leave" },
  { value: "domestic_violence", label: "Domestic violence leave" },
  { value: "injury_on_duty", label: "Injury-on-duty leave" },
  { value: "other", label: "Other leave" },
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number]["value"];

export function leaveTypeLabel(value: string) {
  return LEAVE_TYPES.find((type) => type.value === value)?.label ?? "Other leave";
}
