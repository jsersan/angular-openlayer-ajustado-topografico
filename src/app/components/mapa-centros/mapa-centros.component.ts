import { Component, OnInit, AfterViewInit } from '@angular/core'
import { MatSnackBar } from '@angular/material/snack-bar'

import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import Style from 'ol/style/Style'
import Icon from 'ol/style/Icon'
import { transformExtent, fromLonLat } from 'ol/proj'

import { institutos } from '../../../assets/data/institutos'
import { Asignacion, ciclosAsignacion } from '../../../assets/data/asignacion'

interface Tab {
  id: string
  label: string
}

interface AsignacionConDCB extends Asignacion {
  dcbUrl?: string
}

interface CiclosPorGrado {
  basicos: AsignacionConDCB[]
  medios: AsignacionConDCB[]
  superiores: AsignacionConDCB[]
}

const TIPO_CENTRO_LABELS: Record<string, string> = {
  CAEPA: 'Centro de Atención a la Educación Permanente de Adultos',
  CEAD: 'Centro de Educación a Distancia',
  CEO: 'Centro de Educación Obligatoria',
  CEPA: 'Centro de Educación Permanente de Adultos',
  CIFP: 'Centro Integrado de Formación Profesional',
  CIPFP: 'Centro Integrado Público de Formación Profesional',
  CPEIPS: 'Centro Privado de Educación Infantil, Primaria y Secundaria',
  CPES: 'Centro Privado de Educación Secundaria',
  CPFP: 'Centro Privado de Formación Profesional',
  CPFPED: 'Centro Privado de Formación Profesional a Distancia',
  IES: 'Instituto de Educación Secundaria',
  IFPA: 'Instituto de Formación Profesional Agraria',
  IFPMP: 'Instituto de Formación Profesional y Marítimo Pesquero'
}

const ISLA_LABELS: Record<string, string> = {
  'EL HIERRO': 'El Hierro',
  FUERTEVENTURA: 'Fuerteventura',
  'GRAN CANARIA': 'Gran Canaria',
  'LA GOMERA': 'La Gomera',
  'LA PALMA': 'La Palma',
  LANZAROTE: 'Lanzarote',
  TENERIFE: 'Tenerife'
}

@Component({
  selector: 'app-mapa-centros',
  templateUrl: './mapa-centros.component.html',
  styleUrls: ['./mapa-centros.component.scss']
})
export class MapaCentrosComponent implements OnInit, AfterViewInit {
  private isPanning = false
  private panAttempts = 0
  private readonly MAX_PAN_ATTEMPTS = 1

  map!: Map
  pinsLayer!: VectorLayer<any>

  // ✅ Variables para control de vista
  vistaActual: 'callejero' | 'satelite' = 'callejero'
  private layerCallejero!: TileLayer<OSM>
  private layerSatelite!: TileLayer<XYZ>

  provinciaSeleccionada = ''
  islaSeleccionada = ''
  municipioSeleccionado = ''
  tipoCentroSeleccionado = ''
  familiaSeleccionada = ''
  gradoSeleccionado = ''
  cicloSeleccionado = ''

  municipioEnabled = false

  provincias: string[] = []
  islas: string[] = []
  municipios: string[] = []
  tiposCentro: { value: string; label: string }[] = []
  familiasFiltradas: string[] = []
  ciclosFiltrados: AsignacionConDCB[] = []

  gradosCiclo: { value: string; label: string }[] = [
    { value: 'Básico', label: 'FP Básica' },
    { value: 'Medio', label: 'Grado Medio' },
    { value: 'Superior', label: 'Grado Superior' }
  ]

  tooltipVisible = false
  tooltipContent = ''
  tooltipX = 0
  tooltipY = 0

  popupVisible = false
  centroSeleccionado: any = {}
  selectedCentro: any = null
  tabActiva = 'contacto'
  ciclosCentro: CiclosPorGrado = { basicos: [], medios: [], superiores: [] }
  familiasCentro: string[] = []
  popupPosition = { x: 0, y: 0 }
  popupClass = 'popup-bottom'
  popupContentHeight = 400

  tabs: Tab[] = []

  mostrarModalAdvertencia = false
  mensajeModalAdvertencia = ''

  // Si no tienes sistema de idioma ahora mismo, deja 'es' por defecto.
  // Si más adelante vuelves a meter i18n, puedes enlazar esto a tu servicio de idioma.
  currentLang: 'es' | 'eu' = 'es'

  canariasExtent = transformExtent(
    [-18.2, 27.6, -13.3, 29.5],
    'EPSG:4326',
    'EPSG:3857'
  )

  private readonly ISLAS_EXTENT: Record<
    string,
    [number, number, number, number]
  > = {
    'EL HIERRO': [-18.2, 27.62, -17.85, 27.86],
    FUERTEVENTURA: [-14.53, 28.05, -13.8, 28.78],
    'GRAN CANARIA': [-15.81, 27.74, -15.25, 28.20], // Zoom mejorado ~15%
    'LA GOMERA': [-17.36, 27.98, -17.05, 28.21],
    'LA PALMA': [-18.04, 28.4, -17.73, 28.87],
    LANZAROTE: [-13.95, 28.83, -13.33, 29.32],
    TENERIFE: [-16.87, 28.08, -16.16, 28.58] // Zoom mejorado ~15%
  }

  private readonly MUNICIPIOS_EXTENT: Record<
    string,
    [number, number, number, number]
  > = {
    // Las Palmas
    'LAS PALMAS DE GRAN CANARIA': [-15.49, 28.05, -15.36, 28.19],
    ARUCAS: [-15.6, 28.07, -15.43, 28.18],
    'SANTA LUCIA DE TIRAJANA': [-15.59, 27.77, -15.44, 27.91],
    TELDE: [-15.5, 27.93, -15.35, 28.05],
    INGENIO: [-15.5, 27.86, -15.4, 27.94],
    AGÜIMES: [-15.5, 27.85, -15.4, 27.92],
    AGAETE: [-15.75, 28.06, -15.6, 28.13],
    GÁLDAR: [-15.7, 28.11, -15.6, 28.18],
    MOYA: [-15.65, 28.08, -15.55, 28.15],
    'SANTA MARÍA DE GUÍA': [-15.67, 28.11, -15.6, 28.16],
    FIRGAS: [-15.6325, 28.1025, -15.6175, 28.1175], // Zoom mucho más cercano - pin centrado
    TEROR: [-15.58, 28.03, -15.5, 28.08],
    VALLESECO: [-15.62, 28.0, -15.55, 28.06],
    'VALSEQUILLO DE GRAN CANARIA': [-15.58, 27.97, -15.5, 28.04],
    'VEGA DE SAN MATEO': [-15.6, 27.96, -15.5, 28.03],
    'SAN BARTOLOMÉ DE TIRAJANA': [-15.7, 27.74, -15.5, 27.95],
    MOGÁN: [-15.85, 27.74, -15.57, 27.97],
    'LA ALDEA DE SAN NICOLÁS': [-15.9, 27.95, -15.75, 28.05],

    // Santa Cruz de Tenerife
    'SANTA CRUZ DE TENERIFE': [-16.35, 28.43, -16.15, 28.52],
    'LA LAGUNA': [-16.35, 28.45, -16.25, 28.52],
    ARONA: [-16.72, 28.05, -16.6, 28.15],
    ADEJE: [-16.78, 28.08, -16.68, 28.15],
    'GRANADILLA DE ABONA': [-16.65, 28.05, -16.5, 28.15],
    'PUERTO DE LA CRUZ': [-16.58, 28.39, -16.5, 28.43],
    'LOS REALEJOS': [-16.62, 28.35, -16.52, 28.42],
    'LA OROTAVA': [-16.55, 28.37, -16.48, 28.43],
    'ICOD DE LOS VINOS': [-16.75, 28.35, -16.68, 28.4],
    GÜÍMAR: [-16.45, 28.28, -16.35, 28.35],
    CANDELARIA: [-16.4, 28.32, -16.32, 28.38],
    TACORONTE: [-16.45, 28.45, -16.38, 28.5],
    'EL ROSARIO': [-16.38, 28.38, -16.28, 28.45],
    TEGUESTE: [-16.38, 28.5, -16.32, 28.54],
    'SANTIAGO DEL TEIDE': [-16.88, 28.28, -16.78, 28.35],
    GARACHICO: [-16.8, 28.35, -16.72, 28.4],
    'SAN CRISTÓBAL DE LA LAGUNA': [-16.35, 28.45, -16.25, 28.52],

    // Lanzarote
    ARRECIFE: [-13.6, 28.93, -13.5, 29.0],
    TÍAS: [-13.7, 28.93, -13.6, 29.0],
    YAIZA: [-13.88, 28.87, -13.63, 29.06],
    'SAN BARTOLOMÉ': [-13.63375, 28.93906, -13.56625, 29.00094], // Zoom +50% total - Playa Honda bien visible
    TEGUISE: [-13.65, 29.03, -13.5, 29.15],
    HARÍA: [-13.55, 29.1, -13.45, 29.18],
    TINAJO: [-13.75, 29.03, -13.65, 29.12],

    // Fuerteventura
    'PUERTO DEL ROSARIO': [-13.9, 28.48, -13.8, 28.55],
    ANTIGUA: [-14.05, 28.38, -13.95, 28.48],
    TUINEJE: [-14.12, 28.25, -13.95, 28.45], // Centro movido al sur para ver pines
    PÁJARA: [-14.45, 28.05, -14.05, 28.38],
    BETANCURIA: [-14.15, 28.38, -14.05, 28.45],
    'LA OLIVA': [-13.95, 28.6, -13.8, 28.75],

    // La Palma
    'SANTA CRUZ DE LA PALMA': [-17.8, 28.65, -17.72, 28.7],
    'LOS LLANOS DE ARIDANE': [-17.92266, 28.65446, -17.89734, 28.67554], // Zoom +50% total (muy cercano para 4 pines)
    'BREÑA ALTA': [-17.82, 28.62, -17.75, 28.67],
    'BREÑA BAJA': [-17.85, 28.6, -17.78, 28.65],
    'EL PASO': [-17.9, 28.6, -17.82, 28.68],
    TAZACORTE: [-17.98, 28.63, -17.92, 28.67],
    TIJARAFE: [-18.0, 28.65, -17.92, 28.72],
    PUNTAGORDA: [-18.08, 28.69, -17.96, 28.78],
    GARAFÍA: [-18.08, 28.75, -18.0, 28.82],
    BARLOVENTO: [-17.85, 28.75, -17.78, 28.82],
    'SAN ANDRÉS Y SAUCES': [-17.82, 28.75, -17.75, 28.82],
    PUNTALLANA: [-17.82, 28.7, -17.75, 28.76],
    'VILLA DE MAZO': [-17.82, 28.58, -17.75, 28.63],
    'FUENCALIENTE DE LA PALMA': [-17.88, 28.42, -17.8, 28.5],

    // La Gomera
    'SAN SEBASTIÁN DE LA GOMERA': [-17.15, 28.08, -17.08, 28.13],
    'VALLE GRAN REY': [-17.35, 28.08, -17.28, 28.15],
    VALLEHERMOSO: [-17.28, 28.15, -17.2, 28.2],
    HERMIGUA: [-17.2, 28.13, -17.13, 28.18],
    AGULO: [-17.22, 28.18, -17.17, 28.22],
    ALAJERÓ: [-17.25, 28.05, -17.18, 28.1],

    // El Hierro
    VALVERDE: [-17.95, 27.78, -17.88, 27.83],
    'LA FRONTERA': [-18.08, 27.72, -18.0, 27.78],
    'EL PINAR': [-17.98, 27.68, -17.9, 27.73]
  }

  private fitTerritorio (
    extent4326: [number, number, number, number],
    maxZoom = 13
  ): void {
    const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857')

    // Calcular el tamaño del extent para ajustar el zoom
    const width = extent4326[2] - extent4326[0]
    const height = extent4326[3] - extent4326[1]
    const area = width * height

    // Si el área es muy pequeña (municipio pequeño), usar un zoom más cercano
    let adjustedMaxZoom = maxZoom
    if (area < 0.015) {
      // Municipios muy pequeños
      adjustedMaxZoom = Math.max(maxZoom, 14)
    } else if (area < 0.03) {
      // Municipios pequeños
      adjustedMaxZoom = Math.max(maxZoom, 13)
    }

    this.map.getView().fit(extent3857, {
      duration: 500,
      padding: [40, 40, 40, 40],
      maxZoom: adjustedMaxZoom
    })
  }

  private aplicarZoomTerritorial (): boolean {
    if (!this.map) return false

    const muni = (this.municipioSeleccionado || '').toUpperCase().trim()
    const isla = (this.islaSeleccionada || '').toUpperCase().trim()
    const prov = (this.provinciaSeleccionada || '').toUpperCase().trim()

    // MUNICIPIO - Zoom cercano (14-16)
    if (muni) {
      if (this.MUNICIPIOS_EXTENT[muni]) {
        console.log('🎯 Aplicando zoom a municipio:', muni);
        const maxZoom = 14
        this.fitTerritorio(this.MUNICIPIOS_EXTENT[muni], maxZoom)
        return true
      }
      return false
    }

    // ISLA - Zoom medio (10-11)
    if (isla && this.ISLAS_EXTENT[isla]) {
      console.log('🏝️ Aplicando zoom a isla:', isla);
      this.fitTerritorio(this.ISLAS_EXTENT[isla], 11)
      return true
    }

    // PROVINCIA - Zoom más amplio (9-10) ✅ CORREGIDO
    if (prov === 'LAS PALMAS') {
      console.log('🗺️ Aplicando zoom a provincia: LAS PALMAS');
      this.fitTerritorio([-15.95, 27.7, -13.3, 29.35], 9)
      return true
    }

    if (prov === 'SANTA CRUZ DE TENERIFE') {
      console.log('🗺️ Aplicando zoom a provincia: SANTA CRUZ DE TENERIFE');
      this.fitTerritorio([-18.2, 27.6, -16.0, 29.45], 9)
      return true
    }

    return false
  }

  tipoCentroIcono: Record<string, string> = {
    CAEPA: 'assets/images/marker-caepa.png',
    IES: 'assets/images/marker-ies.png',
    CIFP: 'assets/images/marker-cifp.png',
    CIPFP: 'assets/images/marker-cifp.png',
    CPFP: 'assets/images/marker-cpfpb.png',
    CPFPED: 'assets/images/marker-cpfpb.png',
    CPEIPS: 'assets/images/marker-cpeips.png',
    CPES: 'assets/images/marker-cpes.png',
    CEPA: 'assets/images/marker-cepa.png',
    CEAD: 'assets/images/marker-cead.png',
    CEO: 'assets/images/marker-ceo.png',
    IFPMP: 'assets/images/marker-ifpmp.png',
    IFPA: 'assets/images/marker-ifpa.png'
  }

  constructor (private snackBar: MatSnackBar) {}

  ngOnInit (): void {
    this.cargarListas()
    this.inicializarTabs()
  }

  ngAfterViewInit (): void {
    this.inicializarMapa()
  }

  // ✅✅✅ NUEVO: Método para cambiar entre vistas
  cambiarVista(vista: 'callejero' | 'satelite'): void {
    console.log('🗺️ Cambiando vista a:', vista);
    
    if (this.vistaActual === vista) {
      console.log('⚠️ Ya estás en la vista:', vista);
      return;
    }
    
    this.vistaActual = vista;
    
    // Remover ambas capas primero
    this.map.removeLayer(this.layerCallejero);
    this.map.removeLayer(this.layerSatelite);
    
    // Agregar la capa seleccionada en la posición 0 (fondo)
    if (vista === 'satelite') {
      this.map.getLayers().insertAt(0, this.layerSatelite);
      console.log('✅ Vista satélite activada');
    } else {
      this.map.getLayers().insertAt(0, this.layerCallejero);
      console.log('✅ Vista callejero activada');
    }
  }

  islaLabel (islaRaw: string): string {
    return ISLA_LABELS[islaRaw] ?? islaRaw
  }

  tipoCentroLabel (codigo: string): string {
    return TIPO_CENTRO_LABELS[codigo] ?? codigo
  }

  private inicializarTabs (): void {
    this.tabs = [
      { id: 'contacto', label: 'Contacto' },
      { id: 'oferta', label: 'Oferta' },
      { id: 'basico', label: 'FP Básica' },
      { id: 'medio', label: 'Grado Medio' },
      { id: 'superior', label: 'Grado Superior' }
    ]
  }

  cargarListas (): void {
    const conCiclos = this.obtenerCentrosConCiclos()

    this.provincias = Array.from(
      new Set(institutos.filter(c => conCiclos.has(c.CCEN)).map(c => c.DTERRC))
    ).sort()

    this.islas = Array.from(
      new Set(institutos.filter(c => conCiclos.has(c.CCEN)).map(c => c.ISLA))
    ).sort()

    const tiposSet = new Set<string>()
    institutos
      .filter(c => conCiclos.has(c.CCEN))
      .forEach(c => {
        if (c.DGENRC) tiposSet.add(c.DGENRC)
      })

    this.tiposCentro = Array.from(tiposSet)
      .sort()
      .map(t => ({
        value: t,
        label: this.tipoCentroLabel(t)
      }))

    this.familiasFiltradas = Array.from(
      new Set(ciclosAsignacion.map(c => c.familia))
    ).sort()
  }

  actualizarIslas (): void {
    const conCiclos = this.obtenerCentrosConCiclos()

    this.islas = Array.from(
      new Set(
        institutos
          .filter(
            c =>
              conCiclos.has(c.CCEN) &&
              (!this.provinciaSeleccionada ||
                c.DTERRC === this.provinciaSeleccionada)
          )
          .map(c => c.ISLA)
      )
    ).sort()

    this.islaSeleccionada = ''
    this.municipioSeleccionado = ''
    this.municipioEnabled = false
    this.actualizarFamiliasDisponibles()
    this.actualizarMapa('provincia')
  }

  actualizarMunicipios (): void {
    const conCiclos = this.obtenerCentrosConCiclos()
    const muniSet = new Set<string>()

    institutos
      .filter(c => {
        if (!conCiclos.has(c.CCEN)) return false
        if (
          this.provinciaSeleccionada &&
          c.DTERRC !== this.provinciaSeleccionada
        )
          return false
        if (this.islaSeleccionada && c.ISLA !== this.islaSeleccionada)
          return false
        if (
          this.tipoCentroSeleccionado &&
          c.DGENRC !== this.tipoCentroSeleccionado
        )
          return false
        return true
      })
      .forEach(c => muniSet.add(c.DMUNIC))

    this.municipios = Array.from(muniSet).sort()
    this.municipioEnabled = this.municipios.length > 0
    this.municipioSeleccionado = ''
    this.actualizarFamiliasDisponibles()
    this.actualizarMapa('isla')
  }

  actualizarFamilias (): void {
    this.actualizarFamiliasDisponibles()
    this.actualizarMapa('municipio')
  }

  private obtenerCentrosConCiclos (): Set<string> {
    const s = new Set<string>()
    ciclosAsignacion.forEach(c => c.centros.forEach(ccen => s.add(ccen)))
    return s
  }

  private obtenerCentrosValidos (): Set<string> {
    const s = new Set<string>()
    const conCiclos = this.obtenerCentrosConCiclos()

    institutos.forEach(c => {
      if (!conCiclos.has(c.CCEN)) return
      if (this.provinciaSeleccionada && c.DTERRC !== this.provinciaSeleccionada)
        return
      if (this.islaSeleccionada && c.ISLA !== this.islaSeleccionada) return
      if (this.municipioSeleccionado && c.DMUNIC !== this.municipioSeleccionado)
        return
      if (
        this.tipoCentroSeleccionado &&
        c.DGENRC !== this.tipoCentroSeleccionado
      )
        return
      s.add(c.CCEN)
    })

    return s
  }

  private actualizarFamiliasDisponibles (): void {
    const hayFiltros =
      this.provinciaSeleccionada ||
      this.islaSeleccionada ||
      this.municipioSeleccionado ||
      this.tipoCentroSeleccionado

    if (!hayFiltros) {
      this.familiasFiltradas = Array.from(
        new Set(ciclosAsignacion.map(c => c.familia))
      ).sort()
      return
    }

    const validos = this.obtenerCentrosValidos()
    const famSet = new Set<string>()

    ciclosAsignacion.forEach(ciclo => {
      if (ciclo.centros.some(ccen => validos.has(ccen)))
        famSet.add(ciclo.familia)
    })

    this.familiasFiltradas = Array.from(famSet).sort()
  }

  onChangeFamilia (): void {
    if (!this.familiaSeleccionada) {
      this.gradoSeleccionado = ''
      this.cicloSeleccionado = ''
      this.ciclosFiltrados = []
      this.actualizarMapa('familia')
    } else {
      this.actualizarCiclosPorFamiliaYGrado()
    }
  }

  onChangeGrado (): void {
    if (!this.gradoSeleccionado) {
      this.cicloSeleccionado = ''
      this.ciclosFiltrados = []
      if (this.familiaSeleccionada) {
        this.actualizarCiclosPorFamiliaYGrado()
      } else {
        this.actualizarMapa('grado')
      }
    } else {
      this.actualizarCiclosPorFamiliaYGrado()
    }
  }

  actualizarCiclosPorFamiliaYGrado (): void {
    const validos = this.obtenerCentrosValidos()
    const hayFiltrosGeo = validos.size > 0

    this.ciclosFiltrados = ciclosAsignacion
      .filter(ciclo => {
        if (
          this.familiaSeleccionada &&
          ciclo.familia !== this.familiaSeleccionada
        )
          return false
        if (this.gradoSeleccionado && ciclo.grado !== this.gradoSeleccionado)
          return false
        if (hayFiltrosGeo && !ciclo.centros.some(ccen => validos.has(ccen)))
          return false
        return true
      })
      .map(ciclo => ({
        ...ciclo,
        dcbUrl: this.getDCBUrl(ciclo)
      }))

    this.cicloSeleccionado = ''
    this.actualizarMapa('familia')
  }

  inicializarMapa (): void {
    console.log('🗺️ Inicializando mapa con dos capas...');
    
    // Crear capa de callejero (OpenStreetMap)
    this.layerCallejero = new TileLayer({ 
      source: new OSM()
    })

    // Crear capa satélite (Esri World Imagery)
    this.layerSatelite = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19
      })
    })

    // Crear el mapa con la capa callejero por defecto
    this.map = new Map({
      target: 'map',
      layers: [this.layerCallejero], // Iniciar con callejero
      view: new View({ center: [0, 0], zoom: 2 })
    })

    console.log('✅ Mapa inicializado. Vista actual:', this.vistaActual);

    this.map.getView().fit(this.canariasExtent, {
      duration: 100,
      padding: [30, 30, 30, 30],
      maxZoom: 8
    })

    this.map.on('singleclick', evt => {
      const feature = this.map.forEachFeatureAtPixel(evt.pixel, f => f as any)

      if (feature) {
        const props = feature.getProperties()
        if (!props?.CCEN) return
        this.tooltipVisible = false
        this.onSelectCentro(props, evt.pixel)
      } else {
        if (this.popupVisible) this.cerrarPopup()
      }
    })

    this.map.on('pointermove', evt => {
      const pixel = this.map.getEventPixel(evt.originalEvent)
      const feature = this.map.forEachFeatureAtPixel(pixel, f => f as any)

      if (feature) {
        const props = feature.getProperties()

        if (
          this.popupVisible &&
          this.centroSeleccionado?.CCEN === props['CCEN']
        ) {
          this.tooltipVisible = false
          return
        }

        this.tooltipVisible = true
        this.tooltipContent = props['tooltipNombre'] || props['NOM'] || 'Centro'

        const me = evt.originalEvent as MouseEvent
        let x = me.clientX + 12
        let y = me.clientY - 14

        if (x + 320 > window.innerWidth - 20) x = me.clientX - 320 - 12
        if (y + 50 > window.innerHeight - 20) y = me.clientY - 50 - 14

        this.tooltipX = Math.max(20, x)
        this.tooltipY = Math.max(20, y)
        ;(this.map.getTargetElement() as HTMLElement).style.cursor = 'pointer'
      } else {
        this.tooltipVisible = false
        ;(this.map.getTargetElement() as HTMLElement).style.cursor = ''
      }
    })

    this.pinsLayer = new VectorLayer({
      source: new VectorSource({ features: [] })
    })
    this.map.addLayer(this.pinsLayer)
  }

  actualizarMapa (
    origen:
      | 'provincia'
      | 'isla'
      | 'municipio'
      | 'tipo'
      | 'grado'
      | 'familia'
      | 'ciclo' = 'ciclo'
  ): void {
    if (!this.map) return

    const hayFiltros = !!(
      this.provinciaSeleccionada ||
      this.islaSeleccionada ||
      this.municipioSeleccionado ||
      this.tipoCentroSeleccionado ||
      this.gradoSeleccionado ||
      this.cicloSeleccionado ||
      this.familiaSeleccionada
    )

    if (!hayFiltros) {
      this.limpiarPins()
      this.map.getView().fit(this.canariasExtent, {
        duration: 400,
        padding: [30, 30, 30, 30],
        maxZoom: 8
      })
      return
    }

    const conCiclos = this.obtenerCentrosConCiclos()
    const hayFiltrosCiclos = !!(
      this.familiaSeleccionada ||
      this.gradoSeleccionado ||
      this.cicloSeleccionado
    )

    let ciclosRelevantes: Asignacion[] = [...ciclosAsignacion]

    if (this.gradoSeleccionado) {
      ciclosRelevantes = ciclosRelevantes.filter(
        c => c.grado === this.gradoSeleccionado
      )
    }

    if (this.familiaSeleccionada) {
      ciclosRelevantes = ciclosRelevantes.filter(
        c => c.familia === this.familiaSeleccionada
      )
    }

    if (this.cicloSeleccionado) {
      const esp = ciclosAsignacion.find(
        c => String(c.id) === this.cicloSeleccionado
      )
      ciclosRelevantes = esp ? [esp] : []
    }

    if (hayFiltrosCiclos && ciclosRelevantes.length === 0) {
      this.limpiarPins()
      this.mostrarAdvertencia(
        'No hay ciclos que coincidan con los filtros seleccionados.'
      )
      return
    }

    const centrosDeCiclos = new Set<string>()
    ciclosRelevantes.forEach(c =>
      c.centros.forEach(ccen => centrosDeCiclos.add(ccen))
    )

    const centrosFiltrados = institutos.filter(centro => {
      if (!conCiclos.has(centro.CCEN)) return false
      if (
        this.provinciaSeleccionada &&
        centro.DTERRC !== this.provinciaSeleccionada
      )
        return false
      if (this.islaSeleccionada && centro.ISLA !== this.islaSeleccionada)
        return false
      if (
        this.municipioSeleccionado &&
        centro.DMUNIC !== this.municipioSeleccionado
      )
        return false
      if (
        this.tipoCentroSeleccionado &&
        centro.DGENRC !== this.tipoCentroSeleccionado
      )
        return false
      if (hayFiltrosCiclos && !centrosDeCiclos.has(centro.CCEN)) return false
      return true
    })

    if (centrosFiltrados.length === 0) {
      this.limpiarPins()
      this.mostrarAdvertencia(
        'No se encontraron centros con los filtros aplicados.'
      )
      return
    }

    const features: Feature[] = []

    centrosFiltrados.forEach(centro => {
      if (!centro.LON || !centro.LAT) return

      try {
        const coords = fromLonLat([centro.LON as number, centro.LAT as number])
        const feature = new Feature({ geometry: new Point(coords) })

        const iconoUrl =
          this.tipoCentroIcono[centro.DGENRC] ||
          'assets/images/marker-default.png'

        feature.setStyle(
          new Style({
            image: new Icon({ src: iconoUrl, scale: 0.15, anchor: [0.5, 1] })
          })
        )

        feature.setProperties({
          CCEN: centro.CCEN,
          NOM: centro.NOM,
          tooltipNombre: `${this.tipoCentroLabel(centro.DGENRC)} ${centro.NOM}`,
          DTERRC: centro.DTERRC,
          ISLA: centro.ISLA,
          DMUNIC: centro.DMUNIC,
          DGENRC: centro.DGENRC,
          DOMI: centro.DOMI,
          CPOS: centro.CPOS,
          TEL1: centro.TEL1,
          TFAX: centro.TFAX,
          EMAIL: centro.EMAIL,
          PAGINA: centro.PAGINA,
          LON: centro.LON,
          LAT: centro.LAT
        })

        features.push(feature)
      } catch (e) {
        console.warn(`Error coords centro ${centro.CCEN}`, e)
      }
    })

    if (!features.length) return

    if (this.pinsLayer) this.map.removeLayer(this.pinsLayer)
    this.pinsLayer = new VectorLayer({ source: new VectorSource({ features }) })
    this.map.addLayer(this.pinsLayer)

    const extent = this.pinsLayer.getSource()!.getExtent()

    if (extent && extent[0] !== Infinity) {
      const hayFiltrosTematicos = !!(
        this.tipoCentroSeleccionado ||
        this.familiaSeleccionada ||
        this.gradoSeleccionado ||
        this.cicloSeleccionado
      )

      if (!hayFiltrosTematicos && this.aplicarZoomTerritorial()) {
        return
      }

      const maxZoom =
        features.length === 1
          ? 16 // Un solo centro: muy cercano
          : features.length === 2
          ? 15 // Dos centros: muy cercano también
          : features.length <= 4
          ? 14 // 3-4 centros: cercano
          : features.length <= 8
          ? 13 // 5-8 centros: moderadamente cercano
          : features.length <= 15
          ? 12 // 9-15 centros: medio
          : 10 // Muchos centros: alejado

      this.map.getView().fit(extent, {
        duration: 600,
        padding: [60, 60, 60, 60],
        maxZoom
      })
    }
  }

  private limpiarPins (): void {
    if (this.pinsLayer) this.map.removeLayer(this.pinsLayer)
    this.pinsLayer = new VectorLayer({
      source: new VectorSource({ features: [] })
    })
    this.map.addLayer(this.pinsLayer)
  }

  onSelectCentro (centro: any, pixel: number[]): void {
    if (this.isPanning) return
    this.panAttempts = 0
    this.selectedCentro = centro
    this.centroSeleccionado = centro
    this.cargarCiclosCentro(centro.CCEN)
    this.tabActiva = 'contacto'
    this.mostrarPopupSeguro(pixel)
  }

  mostrarPopupSeguro (pixel: number[]): void {
    const popupWidth = 420
    const popupHeight = 600
    const margin = 50
    const mapEl = this.map.getTargetElement() as HTMLElement
    const rect = mapEl.getBoundingClientRect()
    const [x, y] = pixel

    const necesitaPan =
      x - rect.left < popupWidth / 2 + margin ||
      rect.right - x < popupWidth / 2 + margin ||
      y - rect.top < popupHeight / 2 + margin ||
      rect.bottom - y < popupHeight / 2 + margin

    if (necesitaPan && this.panAttempts < this.MAX_PAN_ATTEMPTS) {
      this.panAttempts++
      this.isPanning = true

      const pinCoord = this.map.getCoordinateFromPixel(pixel)
      if (!pinCoord) {
        this.isPanning = false
        return
      }

      const currentCenter = this.map.getView().getCenter()!
      const res = this.map.getView().getResolution() || 1
      const newCenter: [number, number] = [
        currentCenter[0] + (x - rect.width / 2) * res,
        currentCenter[1] - (y - rect.height / 2) * res
      ]

      this.map.getView().animate({ center: newCenter, duration: 350 }, () => {
        this.isPanning = false
        const newPixel = this.map.getPixelFromCoordinate(pinCoord)
        if (newPixel) this.mostrarPopupEnPosicion(newPixel)
      })
      return
    }

    this.mostrarPopupEnPosicion(pixel)
  }

  private mostrarPopupEnPosicion (pixel: number[]): void {
    const [x, y] = pixel
    const pw = 420
    const ph = 600
    const margin = 20
    const arrow = 30
    const mapEl = this.map.getTargetElement() as HTMLElement
    const rect = mapEl.getBoundingClientRect()

    let px: number
    let py: number
    let cls: string

    if (rect.bottom - y >= ph + margin + arrow) {
      py = y + arrow + 10
      px = x - pw / 2
      cls = 'popup-bottom'
    } else if (y - rect.top >= ph + margin + arrow) {
      py = y - ph - arrow - 10
      px = x - pw / 2
      cls = 'popup-top'
    } else if (rect.right - x >= pw + margin + arrow) {
      px = x + arrow + 10
      py = y - ph / 2
      cls = 'popup-right'
    } else if (x - rect.left >= pw + margin + arrow) {
      px = x - pw - arrow - 10
      py = y - ph / 2
      cls = 'popup-left'
    } else {
      px = x - pw / 2
      py = y - ph / 2
      cls = 'popup-centered'
    }

    this.popupPosition = {
      x: Math.max(rect.left + margin, Math.min(px, rect.right - pw - margin)),
      y: Math.max(rect.top + margin, Math.min(py, rect.bottom - ph - margin))
    }

    this.popupClass = cls
    this.popupVisible = true
  }

  cargarCiclosCentro (ccen: string): void {
    const normaliza = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()

    const ciclosDelCentro: AsignacionConDCB[] = ciclosAsignacion
      .filter(c => c.centros.includes(ccen))
      .map(c => ({
        ...c,
        dcbUrl: this.getDCBUrl(c)
      }))

    this.ciclosCentro = {
      basicos: ciclosDelCentro.filter(c => normaliza(c.grado) === 'BASICO'),
      medios: ciclosDelCentro.filter(c => normaliza(c.grado) === 'MEDIO'),
      superiores: ciclosDelCentro.filter(c => normaliza(c.grado) === 'SUPERIOR')
    }

    this.familiasCentro = Array.from(
      new Set(ciclosDelCentro.map(c => c.familia))
    ).sort()
  }

  getTotalCiclos (tipo: 'basicos' | 'medios' | 'superiores'): number {
    return this.ciclosCentro[tipo]?.length || 0
  }

  irAPestanaPorGrado (tipo: 'basicos' | 'medios' | 'superiores'): void {
    if (this.getTotalCiclos(tipo) === 0) return
    const mapa: Record<string, string> = {
      basicos: 'basico',
      medios: 'medio',
      superiores: 'superior'
    }
    this.cambiarTab(mapa[tipo])
  }

  cambiarTab (tabId: string): void {
    this.tabActiva = tabId
  }

  cerrarPopup (): void {
    this.popupVisible = false
    this.selectedCentro = null
    this.centroSeleccionado = null
    this.isPanning = false
    this.panAttempts = 0
  }

  getImagenCentro (ccen: string): string {
    if (!ccen) return 'assets/images/default-centro.jpg'
    return `assets/images/img_${ccen}.jpg`
  }

  onImageError (event: any): void {
    event.target.src =
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Q2VudHJvPC90ZXh0Pjwvc3ZnPg=='
  }

  mostrarAdvertencia (mensaje: string): void {
    this.mensajeModalAdvertencia = mensaje
    this.mostrarModalAdvertencia = true
  }

  cerrarModalAdvertencia (): void {
    this.mostrarModalAdvertencia = false
  }

  limpiarFiltros (): void {
    this.cerrarPopup()
    this.provinciaSeleccionada = ''
    this.islaSeleccionada = ''
    this.municipioSeleccionado = ''
    this.tipoCentroSeleccionado = ''
    this.gradoSeleccionado = ''
    this.familiaSeleccionada = ''
    this.cicloSeleccionado = ''
    this.municipios = []
    this.municipioEnabled = false
    this.ciclosFiltrados = []
    this.familiasFiltradas = Array.from(
      new Set(ciclosAsignacion.map(c => c.familia))
    ).sort()
    this.actualizarMapa()
  }

  limpiarFiltrosDesdeModal (): void {
    this.cerrarModalAdvertencia()
    this.limpiarFiltros()
  }

  irAInicio (): void {
    this.limpiarFiltros()
    this.map.getView().fit(this.canariasExtent, {
      duration: 400,
      padding: [30, 30, 30, 30],
      maxZoom: 8
    })
  }

  private normalizarTexto (value: string | undefined | null): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ºª]/g, '')
      .replace(/[()]/g, ' ')
      .replace(/[.,:/]/g, ' ')
      .replace(
        /\b(distancia|dual|nocturno|vespertino|presencial|ingles|inglés)\b/g,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim()
  }

  private getNombreCiclo (ciclo: Asignacion): string {
    const c: any = ciclo
    return (
      c.nombre ||
      c.nom ||
      c.nombreCiclo ||
      c.ciclo ||
      c.titulo ||
      c.denominacion ||
      c.DENOMINACION ||
      ''
    )
  }

  private readonly DCB_URLS_CANARIAS: Record<string, string> = {
    // Actividades Físicas y Deportivas
    'acceso y conservacion en instalaciones deportivas':
      'https://todofp.es/que-estudiar/familias-profesionales/actividades-fisicas-deportivas/acceso-y-conservacion-en-instalaciones-deportivas.html',
    'guia en el medio natural y de tiempo libre':
      'https://todofp.es/que-estudiar/familias-profesionales/actividades-fisicas-deportivas/guia-medio-natural-tiempo-libre.html',
    'acondicionamiento fisico':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Actividades_Fisicas_Deportivas/AcondicionamientoFisicoFO.pdf',
    'ensenanza y animacion sociodeportiva':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Actividades_Fisicas_Deportivas/EnsenhanzaAnimacionSociodeportivaFO.pdf',

    // Administración y Gestión
    'servicios administrativos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Administracion_y_Gestion/Servicios_AdministrativosFO.pdf',
    'gestion administrativa':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Administracion_y_Gestion/GestionAdministrativaFO15.pdf',
    'administracion y finanzas':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Administracion_y_Gestion/AdministracionFinanzasFO15.pdf',
    'asistente a la direccion':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Administracion_y_Gestion/AsistenciaDireccionFO15.pdf',
    'asistencia a la direccion':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Administracion_y_Gestion/AsistenciaDireccionFO15.pdf',

    // Agraria
    'actividades agropecuarias':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Agraria/actividades_agropecuarias.pdf',
    'agro jardineria y composiciones florales':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Agraria/Agro-jardineria_Composiciones_FloralesFO.pdf',
    'agrojardineria y composiciones florales':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Agraria/Agro-jardineria_Composiciones_FloralesFO.pdf',
    'aprovechamientos forestales':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Agraria/Aprovechamientos_ForestalesFO.pdf',
    'aprovechamiento y conservacion del medio natural':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Agraria/AprovechamientoConservacionMedioNaturalFO15.pdf',
    'jardineria y floristeria':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Agraria/JardineriaFloristeriaFO15.pdf',
    'produccion agroecologica':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Agraria/ProduccionAgroecologicaFO15.pdf',
    'produccion agropecuaria':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Agraria/ProduccionAgropecuariaFO15.pdf',
    'ganaderia y asistencia en sanidad animal':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Agraria/GanaderiaAsistenciaSanidadAnimalFO.pdf',
    'gestion forestal y del medio natural':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Agraria/GestionForestalMedioNaturalFO15.pdf',
    'paisajismo y medio rural':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Agraria/PaisajismoMedioRuralFO15.pdf',

    // Artes Gráficas
    'artes graficas':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Artes_Graficas/artes_graficas.pdf',
    'impresion grafica':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Artes_Graficas/ImpresionGraficaFO15.pdf',
    'preimpresion digital':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Artes_Graficas/PreimpresionDigitalFO15.pdf',
    'diseno y gestion de la produccion grafica':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Artes_Graficas/Disenyo_y_Gestion_Produccion_GraficaFO.pdf',

    // Comercio y Marketing
    'servicios comerciales':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Comercio_y_Marketing/Servicios_ComercialesFO.pdf',
    'actividades comerciales':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Comercio_y_Marketing/ActividadesComercialesFO15.pdf',
    'comercio internacional':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Comercio_y_Marketing/ComercioInternacionalFO15.pdf',
    'gestion de ventas y espacios comerciales':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Comercio_y_Marketing/GestionVentasEspaciosComercialesFO15.pdf',
    'marketing y publicidad':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Comercio_y_Marketing/MarketingPublicidadFO15.pdf',
    'transporte y logistica':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Comercio_y_Marketing/TransporteLogisticaFO15.pdf',

    // Edificación y Obra Civil
    'reforma y mantenimiento de edificios':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Edificacion_y_Obra_Civil/Reforma_Mantenimiento_EdificiosFO.pdf',
    'obras de interior decoracion y rehabilitacion':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Edificacion_y_Obra_Civil/ObrasInteriorDecoracionRehabilitacionFO15.pdf',
    'proyectos de edificacion':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Edificacion_y_Obra_Civil/ProyectosEdificacionFO15.pdf',
    'proyectos de obra civil':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Edificacion_y_Obra_Civil/ProyectosObraCivilFO15.pdf',
    'organizacion y control de obras de construccion':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Edificacion_y_Obra_Civil/OrganizacionControlObrasConstruccionFO16A.pdf',

    // Electricidad y Electrónica
    'instalaciones electrotecnicas y mecanica':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Electricidad_y_Electronica/instalaciones_electrotecnicas_mecanica.pdf',
    'electricidad y electronica':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Electricidad_y_Electronica/Electricidad_ElectronicaFO.pdf',
    'instalaciones de telecomunicaciones':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Electricidad_y_Electronica/InstalacionesTelecomunicacionesFO15.pdf',
    'instalaciones electricas y automaticas':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Electricidad_y_Electronica/InstalacionesElectricasAutomaticasFO15.pdf',
    'automatizacion y robotica industrial':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Electricidad_y_Electronica/AutomatizacionRoboticaIndustrialFO15.pdf',
    'electromedicina clinica':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Electricidad_y_Electronica/ElectromedicinaClinicaFO.pdf',
    'mantenimiento electronico':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Electricidad_y_Electronica/MantenimientoElectronicoFO15.pdf',
    'sistemas de telecomunicaciones e informaticos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Electricidad_y_Electronica/SistemasTelecomunicacionesInformaticosFO15.pdf',
    'sistemas electrotecnicos y automatizados':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Electricidad_y_Electronica/SistemasElectrotecnicosAutomatizadosFO15.pdf',

    // Energía y Agua
    'redes y estaciones de tratamiento de aguas':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Energia_y_Agua/RedesEstacionesTratamientoAguasFO.pdf',
    'eficiencia energetica y energia solar termica':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Energia_y_Agua/EficienciaEnergeticaEnergiaSolarTermicaFO15.pdf',
    'energias renovables':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Energia_y_Agua/EnergiasRenovablesFO15.pdf',
    'gestion del agua':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Energia_y_Agua/GestionAguaFO.pdf',

    // Fabricación Mecánica
    'fabricacion de elementos metalicos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Fabricacion_mecanica/fabricacion_elementos_metalicos.pdf',
    'fabricacion y montaje':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Fabricacion_mecanica/Fabricacion_MontajeFO.pdf',
    mecanizado:
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Fabricacion_mecanica/MecanizadoFO15.pdf',
    'soldadura y caldereria':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Fabricacion_mecanica/SoldaduraCaldereriaFO15.pdf',
    'construcciones metalicas':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Fabricacion_mecanica/ConstruccionesMetalicasFO15.pdf',
    'programacion de la produccion en fabricacion mecanica':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Fabricacion_mecanica/ProgramacionProduccionFabricacionMecanicaFO15.pdf',

    // Hostelería y Turismo
    'alojamiento y lavanderia':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Hosteleria_y_Turismo/Alojamiento_LavanderiaFO.pdf',
    'cocina y restauracion':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Hosteleria_y_Turismo/Cocina_RestauracionFO.pdf',
    'cocina y gastronomia':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Hosteleria_y_Turismo/CocinaGastronomiaFO15.pdf',
    'servicios en restauracion':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Hosteleria_y_Turismo/ServiciosRestauracionFO15.pdf',
    'agencias de viajes y gestion de eventos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Hosteleria_y_Turismo/AgenciasViajesGestionEventosFO15.pdf',
    'direccion de cocina':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Hosteleria_y_Turismo/DireccionCocinaFO15.pdf',
    'direccion de servicios de restauracion':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Hosteleria_y_Turismo/DireccionServiciosRestauracionFO15.pdf',
    'gestion de alojamientos turisticos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Hosteleria_y_Turismo/GestionAlojamientosTuristicosFO15.pdf',
    'guia informacion y asistencias turisticas':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Hosteleria_y_Turismo/GuiaInformacionAsistenciaTuristicasFO15.pdf',

    // Imagen Personal
    'peluqueria y estetica':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_personal/Peluqueria_EsteticaFO.pdf',
    'estetica y belleza':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_personal/EsteticaBellezaFO15.pdf',
    'peluqueria y cosmetica capilar':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_personal/PeluqueriaCosmeticaCapilarFO15.pdf',
    'asesoria de imagen personal y corporativa':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_personal/AsesoriaImagenPersonalCorporativaFO15.pdf',
    'caracterizacion y maquillaje profesional':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_personal/CaracterizacionMaquillajeProfesionalFO.pdf',
    'estetica integral y bienestar':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_personal/EsteticaIntegralBienestarFO15.pdf',
    'estilismo y direccion de peluqueria':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_personal/EstilismoDireccionPeluqueriaFO15.pdf',

    // Imagen y Sonido
    'video disc jockey y sonido':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_y_sonido/VideoDisc-jockeySonidoFO15.pdf',
    'animaciones 3d juegos y entornos interactivos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_y_sonido/Animacion3DJuegosEntornosInteractivosFO.pdf',
    'iluminacion captacion y tratamiento de imagen':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_y_sonido/Iluminacion-CaptacionTratamientoImagenFO15.pdf',
    'produccion de audiovisuales y espectaculos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_y_sonido/ProduccionAudiovisualesEspectaculosFO15.pdf',
    'realizacion de proyectos audiovisuales y espectaculos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_y_sonido/RealizacionProyectosAudiovisualesEspectaculosFO15.pdf',
    'sonido para audiovisuales y espectaculos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Imagen_y_sonido/SonidoAudiovisualesEspectaculosFO15.pdf',

    // Industrias Alimentarias
    'actividades de panaderia y pasteleria':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Industrias_alimentarias/actividades_panaderia-_pasteleria.pdf',
    'industrias alimentarias':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Industrias_alimentarias/industrias_alimentarias.pdf',
    'aceites de oliva y vinos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Industrias_alimentarias/AceitesOlivaVinosFO.pdf',
    'panaderia reposteria y confiteria':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Industrias_alimentarias/PanaderiaReposteriaConfiteriaFO15.pdf',
    vitivinicultura:
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Industrias_alimentarias/VitiviniculturaFO15.pdf',

    // Informática y Comunicaciones
    'informatica y comunicaciones':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Informatica_y_comunicaciones/Informatica_Comunicaciones_FO.pdf',
    'informatica de oficina':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Informatica_y_comunicaciones/Informatica_OficinaFO.pdf',
    'sistemas microinformaticos y redes':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Informatica_y_comunicaciones/SistemasMicroinformaticosRedes15.pdf',
    'administracion de sistemas informaticos en red':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Informatica_y_comunicaciones/AdministracionSistemasInformaticosRedFO15.pdf',
    'desarrollo de aplicaciones multiplataforma':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Informatica_y_comunicaciones/DesarrolloAplicacionesMultiplataformaFO15.pdf',
    'desarrollo de aplicaciones web':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Informatica_y_comunicaciones/DesarrolloAplicacionesWebFO15.pdf',

    // Instalación y Mantenimiento
    'mantenimiento de viviendas':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Instalaciones_y_mantenimiento/Mantenimiento_ViviendasFO.pdf',
    'instalaciones de produccion de calor':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Instalaciones_y_mantenimiento/InstalacionesProduccionCalorFO15.pdf',
    'instalaciones frigorificas y de climatizacion':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Instalaciones_y_mantenimiento/InstalacionesFrigorificaClimatizacionFO15.pdf',
    'mantenimiento electromecanico':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Instalaciones_y_mantenimiento/MantenimientoElectromecanicoFO15.pdf',
    'mantenimiento de instalaciones termicas y de fluidos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Instalaciones_y_mantenimiento/MantenimientoInstalacionesTermicasFluidosFO15.pdf',
    'mecatronica industrial':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Instalaciones_y_mantenimiento/MecatronicaIndustrialFO15.pdf',
    'prevencion de riesgos profesionales':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Instalaciones_y_mantenimiento/PrevencionRiesgosProfesionalesFO15.pdf',

    // Madera, Mueble y Corcho
    'carpinteria y mueble':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Madera_mueble_y_corcho/Capinteria_MuebleFO.pdf',
    'instalacion y amueblamiento':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Madera_mueble_y_corcho/InstalacionAmueblamientoFO15.pdf',
    'diseno y amueblamiento':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Madera_mueble_y_corcho/DisennoAmueblamientoFO15.pdf',

    // Marítimo-Pesquera
    'mantenimiento de embarcaciones deportivas y de recreo':
      'https://todofp.es/que-estudiar/familias-profesionales/maritimo-pesquera/mnto-embarcaciones-deportivas-recreo.html',
    'cultivos acuicolas':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Maritimo_Pesquera/CultivosAcuicolasFO15.pdf',
    'mantenimiento y control de la maquinaria de buques y embarcaciones':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Maritimo_Pesquera/MantenimientoControlMaquinariaBuquesEmbarcacionesFO15.pdf',
    'navegacion y pesca de litoral':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Maritimo_Pesquera/NavegacionPescaLitoralFO15.pdf',
    'operaciones subacuaticas e hiperbaricas':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Maritimo_Pesquera/OperacionesSubacuaticasHiperbaricasFO15.pdf',
    acuicultura:
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Maritimo_Pesquera/AcuiculturaFO15.pdf',
    'organizacion del mantenimiento de maquinaria de buques y embarcaciones':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Maritimo_Pesquera/OrganizacionMantenimientoMaquinariaBuquesEmbarcacionesFO15.pdf',
    'transporte maritimo y pesca de altura':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Maritimo_Pesquera/TransporteMaritimoPescaAlturaFO15.pdf',

    // Química
    'operaciones de laboratorio':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Quimica/OperacionesLaboratorioFO15.pdf',
    'fabricacion de productos farmaceuticos biotecnologicos y afines':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Quimica/FabricacionProductosFarmaceuticosBiotecnologicosAfinesFO.pdf',
    'laboratorio de analisis y control de calidad':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Quimica/LaboratorioAnalisisControlCalidadFO15.pdf',
    'quimica industrial':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Quimica/QuimicaIndustrialFO.pdf',

    // Sanidad
    'cuidados auxiliares de enfermeria':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Sanidad/CuidadosAuxiliaresEnfermeriaFO15.pdf',
    'emergencias sanitarias':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Sanidad/EmergenciasSanitariasFO15.pdf',
    'farmacia y parafarmacia':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Sanidad/FarmaciaParafarmaciaFO15.pdf',
    'anatomia patologica y citodiagnostico':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Sanidad/AnatomiaPatologicaCitodiagnosticoFO15A.pdf',
    dietetica:
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Sanidad/DieteticaFO15.pdf',
    'documentacion y administracion sanitarias':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Sanidad/DocumentacionAdministracionSanitariasFO15A.pdf',
    'higiene bucodental':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Sanidad/HigieneBucodentalFO15A.pdf',
    'imagen para el diagnostico y medicina nuclear':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Sanidad/ImagenDiagnosticoMedicinaNuclearFO15A.pdf',
    'laboratorio clinico y biomedico':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Sanidad/LaboratorioClinicoBiomedicoFO15A.pdf',
    'radioterapia y dosimetria':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Sanidad/Radioterapia_DosimetriaFO.pdf',

    // Seguridad y Medio Ambiente
    'tecnico en seguridad':
      'https://todofp.es/que-estudiar/familias-profesionales/seguridad-medio-ambiente/tecnico-seguridad-gm.html',
    seguridad:
      'https://todofp.es/que-estudiar/familias-profesionales/seguridad-medio-ambiente/tecnico-seguridad-gm.html',
    'coordinacion de emergencias y proteccion civil':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Seguridad_y_medio_ambiente/CoordinacionEmergenciasProteccionCivilFO.pdf',
    'educacion y control ambiental':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Seguridad_y_medio_ambiente/EducacionControlAmbientalFO15.pdf',
    'quimica y salud ambiental':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Seguridad_y_medio_ambiente/Quimica_Salud_AmbientalFO.pdf',

    // Servicios Socioculturales y a la Comunidad
    'actividades domesticas y limpieza de edificios':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Servicios_socioculturales_y_a_la_comunidad/Actividades_domesticas_limpieza_edificios_FO.pdf',
    'atencion a personas en situacion de dependencia':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Servicios_socioculturales_y_a_la_comunidad/AtencionPersonasSituacionDependenciaFO15.pdf',
    'animacion sociocultural y turistica':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Servicios_socioculturales_y_a_la_comunidad/AnimacionSocioculturalTuristicaFO15.pdf',
    'educacion infantil':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Servicios_socioculturales_y_a_la_comunidad/EducacionInfantilFO15.pdf',
    'integracion social':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Servicios_socioculturales_y_a_la_comunidad/IntegracionSocialFO15.pdf',
    'mediacion comunicativa':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Servicios_socioculturales_y_a_la_comunidad/MediacionComunicativaFO16A.pdf',
    'promocion de igualdad de genero':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Servicios_socioculturales_y_a_la_comunidad/PromocionIgualdadGeneroFO15.pdf',
    'formacion para la movilidad segura y sostenible':
      'https://todofp.es/que-estudiar/familias-profesionales/servicios-socioculturales-comunidad/formacion-movilidad-segura-sostenible.html',

    // Textil, Confección y Piel
    'tapiceria y cortinaje':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Textil_Confeccion_y_Piel/Tapiceria_Cortinaje-FO.pdf',
    'confeccion y moda':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Textil_Confeccion_y_Piel/ConfeccionModaFO15.pdf',
    'patronaje y moda':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Textil_Confeccion_y_Piel/PatronajeModaFO15.pdf',
    'vestuario a medida y de espectaculos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Textil_Confeccion_y_Piel/VestuarioMedidaEspectaculosFO15.pdf',

    // Transporte y Mantenimiento de Vehículos
    'mantenimiento de vehiculos':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Transporte_y_mantenimiento_de_vehiculos/Matenimiento_VehiculosFO.pdf',
    carroceria:
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Transporte_y_mantenimiento_de_vehiculos/CarroceriaFO15.pdf',
    'mantenimiento de material rodante ferroviario':
      'https://todofp.es/que-estudiar/familias-profesionales/transporte-mantenimiento-vehiculos/mnto-material-rodante-ferroviario.html',
    'electromecanica de maquinaria':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Transporte_y_mantenimiento_de_vehiculos/ElectromecanicaMaquinariaFO15.pdf',
    'electromecanica de vehiculos automoviles':
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Transporte_y_mantenimiento_de_vehiculos/ElectromecanicaVehiculosAutomovilesFO15.pdf',
    'mantenimiento de estructuras de madera y mobiliario de embarcaciones de recreo':
      'https://todofp.es/que-estudiar/familias-profesionales/transporte-mantenimiento-vehiculos/mtmo-estructuras-mobiliario-embarcaciones-recreo.html',
    automocion:
      'https://www.gobiernodecanarias.org/cmsgob1/export/sites/educacion/web/formacion_profesional/_galerias/descargas/descargas/3_1/Transporte_y_mantenimiento_de_vehiculos/AutomocionFO15.pdf',

    // Vidrio y Cerámica
    'vidrieria y alfareria':
      'https://todofp.es/que-estudiar/familias-profesionales/vidrio-ceramica/vidreria-alfareria.html'
  }

  getDCBUrl (ciclo: Asignacion): string {
    const nombreOriginal = this.getNombreCiclo(ciclo)
    const nombre = this.normalizarTexto(nombreOriginal)

    if (!nombre) return ''

    if (this.DCB_URLS_CANARIAS[nombre]) {
      return this.DCB_URLS_CANARIAS[nombre]
    }

    const entrada = Object.entries(this.DCB_URLS_CANARIAS).find(
      ([clave]) => nombre.includes(clave) || clave.includes(nombre)
    )

    return entrada ? entrada[1] : ''
  }
}