import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import { PostgresUser, PostgresUserWithRoles } from '../interfaces/postgres-user.interface';

@Injectable()
export class PostgresUserService {
  private readonly logger = new Logger(PostgresUserService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      host: this.configService.get('POSTGRES_HOST', 'localhost'),
      port: this.configService.get('POSTGRES_PORT', 5432),
      database: this.configService.get('POSTGRES_DB', 'users_db'),
      user: this.configService.get('POSTGRES_USER', 'postgres'),
      password: this.configService.get('POSTGRES_PASSWORD', 'postgres'),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async createUser(user: Partial<PostgresUser>): Promise<PostgresUser> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO users (
          username, email, email_verified, first_name, last_name, enabled,
          department, clearance_level, job_title, business_unit,
          territorial_jurisdiction, hierarchy_level, work_location,
          employment_type, verification_status, risk_score, state
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING *
      `;
      
      const values = [
        user.username,
        user.email,
        user.email_verified || false,
        user.first_name,
        user.last_name,
        user.enabled !== false,
        user.department,
        user.clearance_level || 1,
        user.job_title,
        user.business_unit,
        user.territorial_jurisdiction,
        user.hierarchy_level || 1,
        user.work_location,
        user.employment_type || 'PERMANENT',
        user.verification_status || 'PENDING',
        user.risk_score || 0,
        user.state || 'ACTIVE'
      ];

      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  

  async getUserByUsername(username: string): Promise<PostgresUserWithRoles | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM user_complete_info 
        WHERE username = $1 AND enabled = true
      `;
      
      const result = await client.query(query, [username]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async getUserById(id: string): Promise<PostgresUserWithRoles | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM user_complete_info 
        WHERE id = $1
      `;
      
      const result = await client.query(query, [id]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async updateUser(id: string, updates: Partial<PostgresUser>): Promise<PostgresUser> {
    const client = await this.pool.connect();
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const query = `
        UPDATE users 
        SET ${setClause}, updated_timestamp = CURRENT_TIMESTAMP 
        WHERE id = $1 
        RETURNING *
      `;
      
      const values = [id, ...Object.values(updates)];
      const result = await client.query(query, values);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async assignRoleToUser(userId: string, roleName: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Obtenir l'ID du rôle
      const roleQuery = 'SELECT id FROM roles WHERE name = $1';
      const roleResult = await client.query(roleQuery, [roleName]);
      
      if (roleResult.rows.length === 0) {
        throw new Error(`Role ${roleName} not found`);
      }
      
      const roleId = roleResult.rows[0].id;
      
      // Assigner le rôle
      const assignQuery = `
        INSERT INTO user_roles (user_id, role_id, assigned_by) 
        VALUES ($1, $2, $1) 
        ON CONFLICT (user_id, role_id) DO NOTHING
      `;
      
      await client.query(assignQuery, [userId, roleId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async validateUserCredentials(username: string, password: string): Promise<boolean> {
    // Cette méthode sera utilisée par le User Storage Provider
    // Pour l'instant, on retourne true car la validation se fait via Keycloak
    return true;
  }

  async searchUsers(searchTerm: string, limit: number = 50): Promise<PostgresUserWithRoles[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT uci.*, ts_rank(u.search_vector, plainto_tsquery('french', $1)) as rank
        FROM user_complete_info uci
        JOIN users u ON uci.id = u.id
        WHERE u.search_vector @@ plainto_tsquery('french', $1)
          AND uci.enabled = true
        ORDER BY rank DESC, uci.last_name, uci.first_name
        LIMIT $2
      `;
      
      const result = await client.query(query, [searchTerm, limit]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getUserAttributes(userId: string): Promise<Record<string, string>> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT attribute_name, attribute_value 
        FROM user_attributes 
        WHERE user_id = $1
      `;
      
      const result = await client.query(query, [userId]);
      const attributes: Record<string, string> = {};
      
      result.rows.forEach(row => {
        attributes[row.attribute_name] = row.attribute_value;
      });
      
      return attributes;
    } finally {
      client.release();
    }
  }

  async setUserAttribute(userId: string, name: string, value: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO user_attributes (user_id, attribute_name, attribute_value)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, attribute_name) 
        DO UPDATE SET attribute_value = $3
      `;
      
      await client.query(query, [userId, name, value]);
    } finally {
      client.release();
    }
  }
}