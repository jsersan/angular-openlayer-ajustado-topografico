#!/bin/bash

# Script de migración de Angular 15 a Angular 19
# Ejecutar desde la raíz del proyecto

echo "🚀 Iniciando migración de Angular 15 → 19"
echo "=========================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para verificar si el comando fue exitoso
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Paso completado exitosamente${NC}"
    else
        echo -e "${RED}✗ Error en el paso. Revisar antes de continuar.${NC}"
        exit 1
    fi
}

# 1. Verificar que estamos en la raíz del proyecto
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json no encontrado. Ejecutar desde la raíz del proyecto.${NC}"
    exit 1
fi

# 2. Crear backup
echo -e "${YELLOW}📦 Creando backup del proyecto...${NC}"
BACKUP_DIR="backup-angular15-$(date +%Y%m%d-%H%M%S)"
mkdir -p "../$BACKUP_DIR"
cp -r . "../$BACKUP_DIR/"
check_status

# 3. Asegurar que node_modules está limpio
echo -e "${YELLOW}🧹 Limpiando node_modules y cache...${NC}"
rm -rf node_modules package-lock.json
npm cache clean --force
check_status

# 4. Instalar Angular CLI actualizado globalmente
echo -e "${YELLOW}🔧 Instalando Angular CLI más reciente...${NC}"
npm install -g @angular/cli@latest
check_status

# 5. Migración Angular 15 → 16
echo -e "${YELLOW}📈 Migrando a Angular 16...${NC}"
ng update @angular/core@16 @angular/cli@16 --force --allow-dirty
check_status

npm install
check_status

# 6. Migración Angular 16 → 17
echo -e "${YELLOW}📈 Migrando a Angular 17...${NC}"
ng update @angular/core@17 @angular/cli@17 --force --allow-dirty
check_status

npm install
check_status

# 7. Migración Angular 17 → 18
echo -e "${YELLOW}📈 Migrando a Angular 18...${NC}"
ng update @angular/core@18 @angular/cli@18 --force --allow-dirty
check_status

npm install
check_status

# 8. Migración Angular 18 → 19
echo -e "${YELLOW}📈 Migrando a Angular 19 (última versión)...${NC}"
ng update @angular/core@19 @angular/cli@19 --force --allow-dirty
check_status

npm install
check_status

# 9. Actualizar Angular Material
echo -e "${YELLOW}🎨 Actualizando Angular Material...${NC}"
ng update @angular/material@19 --force --allow-dirty
check_status

# 10. Actualizar otras dependencias
echo -e "${YELLOW}📦 Actualizando dependencias compatibles...${NC}"
npm update
check_status

# 11. Verificar la compilación
echo -e "${YELLOW}🔨 Verificando compilación...${NC}"
ng build --configuration development
check_status

# 12. Resumen final
echo ""
echo "=========================================="
echo -e "${GREEN}✓ Migración completada exitosamente${NC}"
echo "=========================================="
echo ""
echo "Versión anterior: Angular 15"
echo "Versión actual: Angular 19"
echo ""
echo -e "${YELLOW}Pasos siguientes:${NC}"
echo "1. Revisar warnings en la consola"
echo "2. Ejecutar: npm test (si tienes tests)"
echo "3. Ejecutar: ng serve"
echo "4. Probar la aplicación manualmente"
echo ""
echo -e "${YELLOW}Backup creado en:${NC} ../$BACKUP_DIR"
echo ""