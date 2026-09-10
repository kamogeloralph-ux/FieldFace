export const EMPLOYEE_COOKIE_NAME = "sp_employee_session";
export const ADMIN_COOKIE_NAME = "sp_admin_session";
export const PLATFORM_COOKIE_NAME = "sp_platform_session";

// Weekend = Saturday(6) + Sunday(0), per Date#getDay(). Change here if a
// deployment needs a different weekend definition (e.g. Fri/Sat).
export const WEEKEND_DAYS = [0, 6];
