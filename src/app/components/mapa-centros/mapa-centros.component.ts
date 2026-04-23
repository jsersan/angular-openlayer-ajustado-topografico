// mapa-centros.component.ts — Adaptado para datos de Canarias (Islas Canarias)
import { Component, OnInit, AfterViewInit } from '@angular/core'
import { MatSnackBar } from '@angular/material/snack-bar'

import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import Style from 'ol/style/Style'
import Icon from 'ol/style/Icon'
import { transformExtent, fromLonLat } from 'ol/proj'

import { TranslateService } from '@ngx-translate/core'

import { institutos } from '../../../assets/data/institutos'
import { Asignacion, ciclosAsignacion } from '../../../assets/data/asignacion';


import { familiasProfesionales } from '../../../assets/data/asignacion'

interface Tab {
  id: string
  label: string
}

interface CiclosCentro {
  basicos: Asignacion[];
  medios: Asignacion[];
  superiores: Asignacion[];
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
  

  currentLang = 'es'
  map!: Map
  pinsLayer!: VectorLayer<any>

  // ── Filtros ──────────────────────────────────────────────────────────
  provinciaSeleccionada = ''   // Las Palmas | Santa Cruz de Tenerife
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
  ciclosFiltrados: Asignacion[] = []

  gradosCiclo: { value: string; label: string }[] = [
    { value: 'Básico', label: 'FP Básica' },
    { value: 'Medio', label: 'Grado Medio' },
    { value: 'Superior', label: 'Grado Superior' }
  ]
  

  

  // ── Tooltip ──────────────────────────────────────────────────────────
  tooltipVisible = false
  tooltipContent = ''
  tooltipX = 0
  tooltipY = 0

  // ── Popup ────────────────────────────────────────────────────────────
  popupVisible = false
  centroSeleccionado: any = {}
  selectedCentro: any = null
  tabActiva = 'contacto'
  
  ciclosCentro: CiclosCentro = { basicos: [], medios: [], superiores: [] }
  familiasCentro: string[] = []
  popupPosition = { x: 0, y: 0 }
  popupClass = 'popup-bottom'
  popupContentHeight = 400

  tabs: Tab[] = []

  // ── Modal advertencia ────────────────────────────────────────────────
  mostrarModalAdvertencia = false
  mensajeModalAdvertencia = ''

  // ── Extent Canarias (WGS84 → EPSG:3857) ─────────────────────────────
  // Cubre todas las islas: desde El Hierro hasta Lanzarote
  canariasExtent = transformExtent(
    [-18.2, 27.6, -13.3, 29.5],
    'EPSG:4326',
    'EPSG:3857'
  )

  tipoCentroIcono: Record<string, string> = {
    IES:    'assets/images/marker-ies.png',
    CIFP:   'assets/images/marker-cifp.png',
    CPFP:   'assets/images/marker-cpfpb.png',
    CPFPED: 'assets/images/marker-cpfpb.png',
    CIPFP:  'assets/images/marker-cpifp.png',
    CPEIPS: 'assets/images/marker-cpeips.png',
    CPES:   'assets/images/marker-cpes.png',
    CEPA:   'assets/images/marker-ies.png',
    CEAD:   'assets/images/marker-ies.png',
    CAEPA:  'assets/images/marker-ies.png',
    CEO:    'assets/images/marker-ies.png',
    IFPMP:  'assets/images/marker-cifp.png',
    IFPA:   'assets/images/marker-cifp.png',
  }

  // ────────────────────────────────────────────────────────────────────
  constructor(
    private snackBar: MatSnackBar,
    private translate: TranslateService
  ) {
    this.translate.setDefaultLang('es')
    this.translate.use('es')
  }

  ngOnInit(): void {
    this.cargarListas()
    this.inicializarTabs()
  }

  ngAfterViewInit(): void {
    this.inicializarMapa()
  }

  // ── Tabs ─────────────────────────────────────────────────────────────
  private inicializarTabs(): void {
    this.tabs = [
      { id: 'contacto',  label: 'Contacto' },
      { id: 'oferta',    label: 'Oferta' },
      { id: 'basico',    label: 'FP Básica' },
      { id: 'medio',     label: 'Grado Medio' },
      { id: 'superior',  label: 'Grado Superior' }
    ]
  }

  // ── Carga de listas de filtros ────────────────────────────────────────
  cargarListas(): void {
    const centrosConCiclos = new Set<string>()
    ciclosAsignacion.forEach(c => c.centros.forEach(ccen => centrosConCiclos.add(ccen)))

    // Provincias
    this.provincias = Array.from(
      new Set(
        institutos
          .filter(c => centrosConCiclos.has(c.CCEN))
          .map(c => c.DTERRC)
      )
    ).sort()

    // Islas
    this.islas = Array.from(
      new Set(
        institutos
          .filter(c => centrosConCiclos.has(c.CCEN))
          .map(c => c.ISLA)
      )
    ).sort()

    // Tipos de centro
    const tiposSet = new Set<string>()
    institutos
      .filter(c => centrosConCiclos.has(c.CCEN))
      .forEach(c => { if (c.DGENRC) tiposSet.add(c.DGENRC) })

    this.tiposCentro = Array.from(tiposSet).sort().map(t => ({ value: t, label: t }))

    // Familias
    this.familiasFiltradas = Array.from(
      new Set(ciclosAsignacion.map(c => c.familia))
    ).sort()
  }

  // ── Filtros en cascada ───────────────────────────────────────────────
  actualizarIslas(): void {
    const centrosConCiclos = this.obtenerCentrosConCiclos()

    this.islas = Array.from(
      new Set(
        institutos
          .filter(c => centrosConCiclos.has(c.CCEN)
            && (!this.provinciaSeleccionada || c.DTERRC === this.provinciaSeleccionada))
          .map(c => c.ISLA)
      )
    ).sort()

    this.islaSeleccionada = ''
    this.municipioSeleccionado = ''
    this.municipioEnabled = false
    this.actualizarFamiliasDisponibles()
    this.actualizarMapa('provincia')
  }

  actualizarMunicipios(): void {
    const centrosConCiclos = this.obtenerCentrosConCiclos()

    const municipiosSet = new Set<string>()
    institutos
      .filter(c => {
        if (!centrosConCiclos.has(c.CCEN)) return false
        if (this.provinciaSeleccionada && c.DTERRC !== this.provinciaSeleccionada) return false
        if (this.islaSeleccionada && c.ISLA !== this.islaSeleccionada) return false
        if (this.tipoCentroSeleccionado && c.DGENRC !== this.tipoCentroSeleccionado) return false
        return true
      })
      .forEach(c => municipiosSet.add(c.DMUNIC))

    this.municipios = Array.from(municipiosSet).sort()
    this.municipioEnabled = this.municipios.length > 0
    this.municipioSeleccionado = ''
    this.actualizarFamiliasDisponibles()
    this.actualizarMapa('isla')
  }

  actualizarFamilias(): void {
    this.actualizarFamiliasDisponibles()
    this.actualizarMapa('municipio')
  }

  private obtenerCentrosConCiclos(): Set<string> {
    const s = new Set<string>()
    ciclosAsignacion.forEach(c => c.centros.forEach(ccen => s.add(ccen)))
    return s
  }

  private obtenerCentrosValidos(): Set<string> {
    const s = new Set<string>()
    const centrosConCiclos = this.obtenerCentrosConCiclos()

    institutos.forEach(c => {
      if (!centrosConCiclos.has(c.CCEN)) return
      if (this.provinciaSeleccionada && c.DTERRC !== this.provinciaSeleccionada) return
      if (this.islaSeleccionada && c.ISLA !== this.islaSeleccionada) return
      if (this.municipioSeleccionado && c.DMUNIC !== this.municipioSeleccionado) return
      if (this.tipoCentroSeleccionado && c.DGENRC !== this.tipoCentroSeleccionado) return
      s.add(c.CCEN)
    })
    return s
  }

  private actualizarFamiliasDisponibles(): void {
    const hayFiltros = this.provinciaSeleccionada || this.islaSeleccionada
      || this.municipioSeleccionado || this.tipoCentroSeleccionado

    if (!hayFiltros) {
      this.familiasFiltradas = Array.from(
        new Set(ciclosAsignacion.map(c => c.familia))
      ).sort()
      return
    }

    const centrosValidos = this.obtenerCentrosValidos()
    const famSet = new Set<string>()
    ciclosAsignacion.forEach(ciclo => {
      if (ciclo.centros.some(ccen => centrosValidos.has(ccen))) {
        famSet.add(ciclo.familia)
      }
    })
    this.familiasFiltradas = Array.from(famSet).sort()
  }

  // ── Cambios en familia / grado ────────────────────────────────────────
  onChangeFamilia(): void {
    if (!this.familiaSeleccionada) {
      this.gradoSeleccionado = ''
      this.cicloSeleccionado = ''
      this.ciclosFiltrados = []
      this.actualizarMapa('familia')
    } else {
      this.actualizarCiclosPorFamiliaYGrado()
    }
  }

  onChangeGrado(): void {
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

  actualizarCiclosPorFamiliaYGrado(): void {
    const centrosValidos = this.obtenerCentrosValidos()
    const hayFiltrosGeo = centrosValidos.size > 0

    this.ciclosFiltrados = ciclosAsignacion.filter(ciclo => {
      if (this.familiaSeleccionada && ciclo.familia !== this.familiaSeleccionada) return false
      if (this.gradoSeleccionado && ciclo.grado !== this.gradoSeleccionado) return false
      if (hayFiltrosGeo && !ciclo.centros.some(ccen => centrosValidos.has(ccen))) return false
      return true
    })

    this.cicloSeleccionado = ''
    this.actualizarMapa('familia')
  }

  // ── Mapa ─────────────────────────────────────────────────────────────
  inicializarMapa(): void {
    this.map = new Map({
      target: 'map',
      layers: [new TileLayer({ source: new OSM() })],
      view: new View({ center: [0, 0], zoom: 2 })
    })

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
        if (this.popupVisible && this.centroSeleccionado?.CCEN === props['CCEN']) {
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

    this.pinsLayer = new VectorLayer({ source: new VectorSource({ features: [] }) })
    this.map.addLayer(this.pinsLayer)
  }

  actualizarMapa(
    origen: 'provincia' | 'isla' | 'municipio' | 'tipo' | 'grado' | 'familia' | 'ciclo' = 'ciclo'
  ): void {
    if (!this.map) return

    const hayFiltros = !!(
      this.provinciaSeleccionada || this.islaSeleccionada
      || this.municipioSeleccionado || this.tipoCentroSeleccionado
      || this.gradoSeleccionado || this.cicloSeleccionado || this.familiaSeleccionada
    )

    if (!hayFiltros) {
      this.limpiarPins()
      this.map.getView().fit(this.canariasExtent, { duration: 400, padding: [30, 30, 30, 30], maxZoom: 8 })
      return
    }

    const centrosConCiclos = this.obtenerCentrosConCiclos()
    const hayFiltrosCiclos = !!(this.familiaSeleccionada || this.gradoSeleccionado || this.cicloSeleccionado)

    // Filtrar ciclos relevantes
    let ciclosRelevantes: Asignacion[] = [...ciclosAsignacion]
    if (this.gradoSeleccionado) ciclosRelevantes = ciclosRelevantes.filter(c => c.grado === this.gradoSeleccionado)
    if (this.familiaSeleccionada) ciclosRelevantes = ciclosRelevantes.filter(c => c.familia === this.familiaSeleccionada)
    if (this.cicloSeleccionado) {
      const esp = ciclosAsignacion.find(c => String(c.id) === this.cicloSeleccionado)
      ciclosRelevantes = esp ? [esp] : []
    }

    if (hayFiltrosCiclos && ciclosRelevantes.length === 0) {
      this.limpiarPins()
      this.mostrarAdvertencia('No hay ciclos que coincidan con los filtros seleccionados.')
      return
    }

    const centrosDeCiclos = new Set<string>()
    ciclosRelevantes.forEach(c => c.centros.forEach(ccen => centrosDeCiclos.add(ccen)))

    // Filtrar centros
    const centrosFiltrados = institutos.filter(centro => {
      if (!centrosConCiclos.has(centro.CCEN)) return false
      if (this.provinciaSeleccionada && centro.DTERRC !== this.provinciaSeleccionada) return false
      if (this.islaSeleccionada && centro.ISLA !== this.islaSeleccionada) return false
      if (this.municipioSeleccionado && centro.DMUNIC !== this.municipioSeleccionado) return false
      if (this.tipoCentroSeleccionado && centro.DGENRC !== this.tipoCentroSeleccionado) return false
      if (hayFiltrosCiclos && !centrosDeCiclos.has(centro.CCEN)) return false
      return true
    })

    if (centrosFiltrados.length === 0) {
      this.limpiarPins()
      this.mostrarAdvertencia('No se encontraron centros con los filtros aplicados.')
      return
    }

    // Crear features — coordenadas WGS84 (LON/LAT) → EPSG:3857
    const features: Feature<Point>[] = []
    centrosFiltrados.forEach(centro => {
      if (!centro.LON || !centro.LAT) return
      try {
        const coords = fromLonLat([centro.LON as number, centro.LAT as number])
        const feature = new Feature<Point>({ geometry: new Point(coords) })

        const iconoUrl = this.tipoCentroIcono[centro.DGENRC] || 'assets/images/marker-default.png'
        feature.setStyle(new Style({
          image: new Icon({ src: iconoUrl, scale: 0.15, anchor: [0.5, 1] })
        }))

        feature.setProperties({
          CCEN: centro.CCEN,
          NOM: centro.NOM,
          tooltipNombre: `${centro.DGENRC} ${centro.NOM}`,
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
      const maxZoom = features.length === 1 ? 16 : features.length <= 3 ? 14 : features.length <= 10 ? 12 : 10
      this.map.getView().fit(extent, { duration: 600, padding: [60, 60, 60, 60], maxZoom })
    }
  }

  private limpiarPins(): void {
    if (this.pinsLayer) this.map.removeLayer(this.pinsLayer)
    this.pinsLayer = new VectorLayer({ source: new VectorSource({ features: [] }) })
    this.map.addLayer(this.pinsLayer)
  }

  // ── Selección de centro ──────────────────────────────────────────────
  onSelectCentro(centro: any, pixel: number[]): void {
    if (this.isPanning) return
    this.panAttempts = 0
    this.selectedCentro = centro
    this.centroSeleccionado = centro
    this.cargarCiclosCentro(centro.CCEN)
    this.tabActiva = 'contacto'
    this.mostrarPopupSeguro(pixel)
  }

  mostrarPopupSeguro(pixel: number[]): void {
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
      if (!pinCoord) { this.isPanning = false; return }
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

  private mostrarPopupEnPosicion(pixel: number[]): void {
    const [x, y] = pixel
    const pw = 420, ph = 600, margin = 20, arrow = 30
    const mapEl = this.map.getTargetElement() as HTMLElement
    const rect = mapEl.getBoundingClientRect()

    let px: number, py: number, cls: string
    if (rect.bottom - y >= ph + margin + arrow) {
      py = y + arrow + 10; px = x - pw / 2; cls = 'popup-bottom'
    } else if (y - rect.top >= ph + margin + arrow) {
      py = y - ph - arrow - 10; px = x - pw / 2; cls = 'popup-top'
    } else if (rect.right - x >= pw + margin + arrow) {
      px = x + arrow + 10; py = y - ph / 2; cls = 'popup-right'
    } else if (x - rect.left >= pw + margin + arrow) {
      px = x - pw - arrow - 10; py = y - ph / 2; cls = 'popup-left'
    } else {
      px = x - pw / 2; py = y - ph / 2; cls = 'popup-centered'
    }

    this.popupPosition = {
      x: Math.max(rect.left + margin, Math.min(px, rect.right - pw - margin)),
      y: Math.max(rect.top + margin, Math.min(py, rect.bottom - ph - margin))
    }
    this.popupClass = cls
    this.popupVisible = true
  }

  // ── Carga de ciclos del centro ────────────────────────────────────────
  cargarCiclosCentro(ccen: string): void {
    const normaliza = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
    const ciclosDelCentro = ciclosAsignacion.filter(c => c.centros.includes(ccen))

    this.ciclosCentro = {
      basicos:    ciclosDelCentro.filter(c => normaliza(c.grado) === 'BASICO'),
      medios:     ciclosDelCentro.filter(c => normaliza(c.grado) === 'MEDIO'),
      superiores: ciclosDelCentro.filter(c => normaliza(c.grado) === 'SUPERIOR')
    }
    this.familiasCentro = Array.from(new Set(ciclosDelCentro.map(c => c.familia))).sort()
  }

  getTotalCiclos(tipo: 'basicos' | 'medios' | 'superiores'): number {
    return this.ciclosCentro[tipo]?.length || 0
  }

  irAPestanaPorGrado(tipo: 'basicos' | 'medios' | 'superiores'): void {
    if (this.getTotalCiclos(tipo) === 0) return
    const map: Record<string, string> = { basicos: 'basico', medios: 'medio', superiores: 'superior' }
    this.cambiarTab(map[tipo])
  }

  // ── Popup helpers ─────────────────────────────────────────────────────
  cambiarTab(tabId: string): void { this.tabActiva = tabId }

  cerrarPopup(): void {
    this.popupVisible = false
    this.selectedCentro = null
    this.centroSeleccionado = null
    this.isPanning = false
    this.panAttempts = 0
  }

  getImagenCentro(ccen: string): string {
    if (!ccen) return 'assets/images/default-centro.jpg'
    return `assets/images/img_${ccen}.jpg`
  }

  onImageError(event: any): void {
    event.target.src =
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Q2VudHJvPC90ZXh0Pjwvc3ZnPg=='
  }

  // ── Modal advertencia ─────────────────────────────────────────────────
  mostrarAdvertencia(mensaje: string): void {
    this.mensajeModalAdvertencia = mensaje
    this.mostrarModalAdvertencia = true
  }

  cerrarModalAdvertencia(): void { this.mostrarModalAdvertencia = false }

  // ── Limpiar ────────────────────────────────────────────────────────────
  limpiarFiltros(): void {
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
    this.familiasFiltradas = Array.from(new Set(ciclosAsignacion.map(c => c.familia))).sort()
    this.actualizarMapa()
  }

  limpiarFiltrosDesdeModal(): void {
    this.cerrarModalAdvertencia()
    this.limpiarFiltros()
  }

  irAInicio(): void {
    this.limpiarFiltros()
    this.map.getView().fit(this.canariasExtent, { duration: 400, padding: [30, 30, 30, 30], maxZoom: 8 })
  }
}