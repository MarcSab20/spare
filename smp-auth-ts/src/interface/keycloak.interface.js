"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtendedKeycloakClient = void 0;
class ExtendedKeycloakClient {
    baseClient;
    config;
    constructor(baseClient, config) {
        this.baseClient = baseClient;
        this.config = config;
    }
    async validateToken(token) {
        return this.baseClient.validateToken(token);
    }
    async getRoles(userId) {
        return this.baseClient.getRoles(userId);
    }
    async getUserInfo(userId) {
        return this.baseClient.getUserInfo(userId);
    }
    async getAdminToken() {
        return this.baseClient.getAdminToken();
    }
    async validateTokenRaw(token) {
        const axios = await Promise.resolve().then(() => require('axios'));
        const url = `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/token/introspect`;
        const params = new URLSearchParams();
        params.append('token', token);
        params.append('client_id', this.config.clientId);
        params.append('client_secret', this.config.clientSecret);
        const response = await axios.default.post(url, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: this.config.timeout || 5000
        });
        return response.data;
    }
    async getUserData(userId) {
        const axios = await Promise.resolve().then(() => require('axios'));
        const adminToken = await this.getAdminToken();
        const url = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}`;
        const response = await axios.default.get(url, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            timeout: this.config.timeout || 5000
        });
        return response.data;
    }
    async refreshAdminToken() {
        return this.getAdminToken();
    }
    async createUser(userData) {
        const axios = await Promise.resolve().then(() => require('axios'));
        const adminToken = await this.getAdminToken();
        const url = `${this.config.url}/admin/realms/${this.config.realm}/users`;
        const response = await axios.default.post(url, userData, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            timeout: this.config.timeout || 5000
        });
        const location = response.headers.location;
        return location ? location.split('/').pop() || '' : '';
    }
    async updateUser(userId, userData) {
        const axios = await Promise.resolve().then(() => require('axios'));
        const adminToken = await this.getAdminToken();
        const url = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}`;
        await axios.default.put(url, userData, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            timeout: this.config.timeout || 5000
        });
    }
    async deleteUser(userId) {
        const axios = await Promise.resolve().then(() => require('axios'));
        const adminToken = await this.getAdminToken();
        const url = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}`;
        await axios.default.delete(url, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            timeout: this.config.timeout || 5000
        });
    }
    async enableUser(userId) {
        await this.updateUser(userId, { enabled: true });
    }
    async disableUser(userId) {
        await this.updateUser(userId, { enabled: false });
    }
    async assignRoles(userId, roles) {
        throw new Error('Method not implemented. Please implement assignRoles based on your Keycloak setup.');
    }
    async removeRoles(userId, roles) {
        throw new Error('Method not implemented. Please implement removeRoles based on your Keycloak setup.');
    }
    async getUserRealmRoles(userId) {
        return this.getRoles(userId);
    }
    async getUserClientRoles(userId, clientId) {
        throw new Error('Method not implemented. Please implement getUserClientRoles based on your Keycloak setup.');
    }
    async addUserToGroup(userId, groupId) {
        throw new Error('Method not implemented. Please implement addUserToGroup based on your Keycloak setup.');
    }
    async removeUserFromGroup(userId, groupId) {
        throw new Error('Method not implemented. Please implement removeUserFromGroup based on your Keycloak setup.');
    }
    async getUserGroups(userId) {
        throw new Error('Method not implemented. Please implement getUserGroups based on your Keycloak setup.');
    }
    async getUserSessions(userId) {
        throw new Error('Method not implemented. Please implement getUserSessions based on your Keycloak setup.');
    }
    async logoutUser(userId) {
        throw new Error('Method not implemented. Please implement logoutUser based on your Keycloak setup.');
    }
    async logoutAllSessions(userId) {
        throw new Error('Method not implemented. Please implement logoutAllSessions based on your Keycloak setup.');
    }
    async searchUsers(query, limit) {
        throw new Error('Method not implemented. Please implement searchUsers based on your Keycloak setup.');
    }
    async getUserByUsername(username) {
        throw new Error('Method not implemented. Please implement getUserByUsername based on your Keycloak setup.');
    }
    async getUserByEmail(email) {
        throw new Error('Method not implemented. Please implement getUserByEmail based on your Keycloak setup.');
    }
    async healthCheck() {
        try {
            const axios = await Promise.resolve().then(() => require('axios'));
            const url = `${this.config.url}/realms/${this.config.realm}`;
            const response = await axios.default.get(url, {
                timeout: this.config.timeout || 5000
            });
            return response.status === 200;
        }
        catch (error) {
            return false;
        }
    }
    async getServerInfo() {
        const axios = await Promise.resolve().then(() => require('axios'));
        const url = `${this.config.url}/admin/serverinfo`;
        const adminToken = await this.getAdminToken();
        const response = await axios.default.get(url, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            timeout: this.config.timeout || 5000
        });
        return response.data;
    }
}
exports.ExtendedKeycloakClient = ExtendedKeycloakClient;
//# sourceMappingURL=keycloak.interface.js.map