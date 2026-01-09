#!/bin/bash
# ===========================================
# Create SSH user for QGIS collaborator
# Run on server: sudo ./create_ssh_user.sh <username> "<public_key>"
# ===========================================

set -e

USERNAME=$1
PUBLIC_KEY=$2

if [ -z "$USERNAME" ] || [ -z "$PUBLIC_KEY" ]; then
    echo "Usage: sudo $0 <username> \"<public_key>\""
    echo "Example: sudo $0 qgis_tanaka \"ssh-ed25519 AAAA... tanaka@example.com\""
    exit 1
fi

# Check if user already exists
if id "$USERNAME" &>/dev/null; then
    echo "Error: User $USERNAME already exists"
    exit 1
fi

# Create user
echo "Creating user: $USERNAME"
adduser "$USERNAME" --disabled-password --gecos ""

# Setup SSH directory
mkdir -p /home/$USERNAME/.ssh
echo "$PUBLIC_KEY" > /home/$USERNAME/.ssh/authorized_keys

# Set permissions
chown -R $USERNAME:$USERNAME /home/$USERNAME/.ssh
chmod 700 /home/$USERNAME/.ssh
chmod 600 /home/$USERNAME/.ssh/authorized_keys

echo "=========================================="
echo "User $USERNAME created successfully!"
echo ""
echo "Collaborator can now connect with:"
echo "  ssh -L 5433:127.0.0.1:5433 $USERNAME@18.177.72.233"
echo ""
echo "Database credentials:"
echo "  Username: nagoya_editor"
echo "  Password: [provide separately]"
echo "=========================================="
