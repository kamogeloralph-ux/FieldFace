-- Convert the existing Micon water employee number to the company-prefixed format.
-- The legacy-value guard makes this safe to apply after the live record has already
-- been updated, and prevents changing a future employee that has a different code.
update public.employees as employee
set employee_code = 'MIC001'
from public.employers as employer
where employee.employer_id = employer.id
  and upper(employer.name) = 'MICON WATER'
  and employee.employee_code = 'Ralph01';
