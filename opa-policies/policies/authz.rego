package authz

# Règle par défaut : refuser
default allow = false

# Décision principale avec priorité des refus
allow if {
    not deny  # Vérifier d'abord qu'il n'y a pas de règle de refus explicite
    is_allowed  # Puis vérifier si une règle d'autorisation s'applique
}

# Règles de refus explicites prioritaires
deny if {
    is_owner_deleting_official_org
}

# Règle spécifique: propriétaire ne peut pas supprimer une organisation officielle
is_owner_deleting_official_org if {
    input.action == "delete"
    input.resource.type == "Organization"
    input.resource.attributes.isOfficial == true
    input.user.id == input.resource.attributes.userId
}

# Collection de toutes les règles d'autorisation
is_allowed if {
    rbac_rules
}

is_allowed if {
    abac_rules
}

# --- RÈGLES RBAC ---
rbac_rules if {
    is_platform_admin
}

rbac_rules if {
    has_platform_role_permission
}

rbac_rules if {
    has_org_role_permission
}

rbac_rules if {
    is_resource_owner
    not is_owner_deleting_official_org  # Vérification supplémentaire
}

# Règle: Administrateur de plateforme peut tout faire
is_platform_admin if {
    role_matches("PLATFORM_ADMIN", input.user.roles)
}

# Règle: Autorisation basée sur les rôles de plateforme
has_platform_role_permission if {
    role := input.user.roles[_]
    platform_rules[input.resource.type][input.action][role]
}

# Règle: Autorisation basée sur les rôles d'organisation
has_org_role_permission if {
    org_id := input.resource.attributes.organizationId
    org_id != null
    
    org_id == input.user.organization_ids[_]
    
    role := input.user.roles[_]
    org_rules[input.resource.type][input.action][role]
}

# Règle: Propriétaire de ressource
is_resource_owner if {
    input.user.id == input.resource.attributes.userId
}

# --- RÈGLES ABAC ---
abac_rules if {
    same_department
}

abac_rules if {
    non_confidential_read
}

abac_rules if {
    sufficient_clearance
}

abac_rules if {
    internal_ip
}

# Règle: Même département
same_department if {
    input.action == "read"  # Uniquement pour l'action read
    
    user_dept := input.user.attributes.department
    res_dept := input.resource.attributes.department
    
    user_dept != null
    res_dept != null
    
    user_dept == res_dept
}

# Règle: Document non confidentiel en lecture
non_confidential_read if {
    input.resource.attributes.confidential == false
    input.action == "read"
}

# Règle: Niveau de sécurité suffisant
sufficient_clearance if {
    input.resource.attributes.confidential == true
    input.action == "read"
    
    user_clearance := safe_number(input.user.attributes.clearanceLevel)
    required_clearance := safe_number(input.resource.attributes.requiredClearance)
    
    required_clearance > 0
    user_clearance >= required_clearance
}

# Règle: IP interne
internal_ip if {
    context_ip := input.context.ip
    startswith(context_ip, "127.0.0.")
}

internal_ip if {
    context_ip := input.context.ip
    startswith(context_ip, "10.")
}

# --- FONCTIONS UTILITAIRES ---
# Fonction utilitaire: correspondance de rôle
role_matches(required_role, user_roles) if {
    user_roles[_] == required_role
}

# Fonction utilitaire: conversion sécurisée en nombre
safe_number(val) = num if {
    val != null
    is_number(val)
    num = val
} else = num if {
    val != null
    is_string(val)
    num = to_number(val)
} else = 0

# --- DÉFINITION DES RÈGLES RBAC ---
platform_rules = {
    "Application": {
        "read": {"PLATFORM_SELLER": true, "PLATFORM_BUYER": true, "SUPPORT_AGENT": true},
        "create": {"PLATFORM_SELLER": true},
        "update": {"PLATFORM_SELLER": true, "SUPPORT_AGENT": true},
        "delete": {"PLATFORM_SELLER": true}
    },
    "Asset": {
        "read": {"PLATFORM_SELLER": true, "PLATFORM_BUYER": true, "SUPPORT_AGENT": true},
        "create": {"PLATFORM_SELLER": true},
        "update": {"PLATFORM_SELLER": true, "SUPPORT_AGENT": true},
        "delete": {"PLATFORM_SELLER": true}
    },
    "Comment": {
        "read": {"PLATFORM_SELLER": true, "PLATFORM_BUYER": true, "SUPPORT_AGENT": true},
        "create": {"PLATFORM_SELLER": true, "PLATFORM_BUYER": true},
        "update": {"SUPPORT_AGENT": true},
        "delete": {"SUPPORT_AGENT": true}
    },
    "Organization": {
        "read": {"PLATFORM_SELLER": true, "PLATFORM_BUYER": true, "SUPPORT_AGENT": true},
        "create": {"PLATFORM_SELLER": true, "PLATFORM_BUYER": true},
        "update": {"SUPPORT_AGENT": true},
        "delete": {"PLATFORM_ADMIN": true}
    },
    "User": {
        "read": {"SUPPORT_AGENT": true},
        "update": {"SUPPORT_AGENT": true}
    }
}

org_rules = {
    "Asset": {
        "read": {"ORG_MANAGER": true, "ORG_MEMBER": true},
        "create": {"ORG_MANAGER": true},
        "update": {"ORG_MANAGER": true},
        "delete": {"ORG_MANAGER": true}
    },
    "Comment": {
        "read": {"ORG_MANAGER": true, "ORG_MEMBER": true},
        "create": {"ORG_MANAGER": true, "ORG_MEMBER": true},
        "update": {"ORG_MANAGER": true},
        "delete": {"ORG_MANAGER": true}
    },
    "Service": {
        "read": {"ORG_MANAGER": true, "ORG_MEMBER": true},
        "create": {"ORG_MANAGER": true},
        "update": {"ORG_MANAGER": true},
        "delete": {"ORG_MANAGER": true}
    }
}

# --- STRUCTURE DE DÉCISION COMPLÈTE ---
decision = {
    "allow": allow,
    "reason": reason
} if {
    deny
    reason = "Accès refusé - Règle de refus explicite"
} else = {
    "allow": allow,
    "reason": reason
} if {
    is_platform_admin
    reason = "Autorisé - Administrateur de plateforme"
} else = {
    "allow": allow,
    "reason": reason
} if {
    has_platform_role_permission
    reason = "Autorisé - Rôle de plateforme"
} else = {
    "allow": allow,
    "reason": reason
} if {
    has_org_role_permission
    reason = "Autorisé - Rôle d'organisation"
} else = {
    "allow": allow,
    "reason": reason
} if {
    is_resource_owner
    reason = "Autorisé - Propriétaire de ressource"
} else = {
    "allow": allow,
    "reason": reason
} if {
    same_department
    reason = "Autorisé - Même département"
} else = {
    "allow": allow,
    "reason": reason
} if {
    non_confidential_read
    reason = "Autorisé - Document non confidentiel"
} else = {
    "allow": allow,
    "reason": reason
} if {
    sufficient_clearance
    reason = "Autorisé - Niveau de sécurité suffisant"
} else = {
    "allow": allow,
    "reason": reason
} if {
    internal_ip
    reason = "Autorisé - IP interne"
} else = {
    "allow": false,
    "reason": "Accès refusé - Aucune politique applicable"
}