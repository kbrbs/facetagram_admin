import { auth } from './firebase-config.js';

export function checkAuth() {
    return new Promise((resolve) => {
        auth.onAuthStateChanged((user) => {
            if (!user) {
                window.location.href = '../login.html';
            } else {
                resolve(user);
            }
        });
    });
}