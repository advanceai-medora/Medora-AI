console.log('time-utils.js loaded');

/**
 * Converts a date to Eastern Standard Time (EST, UTC-5) and formats it.
 * @param {string|Date} date - The date to convert (ISO string or Date object).
 * @param {string} format - The desired format (e.g., 'MM/DD/YYYY HH:mm:ss').
 * @returns {string} - The formatted date in EST.
 */
function toEST(date) {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date');
        }

        // Get the UTC time in milliseconds
        const utcTime = dateObj.getTime();

        // Calculate EST offset (UTC-5, no DST for strict EST)
        const estOffset = -5 * 60; // -5 hours in minutes

        // Apply the offset to get EST time
        const estTime = new Date(utcTime + (estOffset * 60 * 1000));

        return estTime;
    } catch (error) {
        console.error('Error converting to EST:', error);
        return null;
    }
}

/**
 * Formats a date to the specified format in EST.
 * @param {string|Date} date - The date to format.
 * @param {string} format - The desired format (e.g., 'MM/DD/YYYY HH:mm:ss').
 * @returns {string} - The formatted date string in EST.
 */
function formatEST(date, format) {
    try {
        const estDate = toEST(date);
        if (!estDate) {
            throw new Error('Failed to convert date to EST');
        }

        // Helper function to pad numbers
        const pad = (num, size) => String(num).padStart(size, '0');

        // Extract date components
        const year = estDate.getFullYear();
        const month = estDate.getMonth() + 1; // Months are 0-based
        const day = estDate.getDate();
        const hours = estDate.getHours();
        const minutes = estDate.getMinutes();
        const seconds = estDate.getSeconds();

        // Replace format tokens
        let formatted = format
            .replace('YYYY', year)
            .replace('MM', pad(month, 2))
            .replace('DD', pad(day, 2))
            .replace('HH', pad(hours, 2))
            .replace('mm', pad(minutes, 2))
            .replace('ss', pad(seconds, 2));

        return formatted;
    } catch (error) {
        console.error('Error formatting date in EST:', error);
        return new Date(date).toLocaleString(); // Fallback to local time
    }
}

// Expose functions to the global scope
window.toEST = toEST;
window.formatEST = formatEST;
