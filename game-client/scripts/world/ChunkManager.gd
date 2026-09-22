extends Node3D
## Streams Chunk nodes in a radius around the player, and only that radius -
## never the whole 100,000,000-pixel world. One API call per reload fetches
## every owned pixel across the whole requested area in a single sparse
## response (see server pixelService.getChunkPixels); this script buckets
## that response by chunk and (re)builds only the chunks that changed.

const RADIUS := 3 # chunks in each direction -> a (2*RADIUS+1)^2 area streamed
const RELOAD_INTERVAL := 0.5

var world: Dictionary = {}
var player: Node3D
## Shared ShaderMaterial (grid_ground.gdshader) every chunk's ground uses -
## see Main.gd, which updates its `fade_center` uniform to the player's
## position each frame. Optional: falls back to a plain gray material per
## chunk if never set.
var ground_material: Material
var loaded_chunks: Dictionary = {} # "cx,cy" -> Chunk
## Flat "x,y" -> pixel-data lookup covering every owned pixel in the
## currently-loaded radius, rebuilt on every reload. Lets the crosshair show
## accurate ownership instantly (AVAILABLE / OWNED BY YOU / OWNED BY x)
## without a network round-trip for every pixel the player looks at - see
## Main.gd `_update_target_info()`.
var pixel_lookup: Dictionary = {}
var _last_center: Vector2i = Vector2i(1 << 30, 1 << 30)
var _reload_timer: float = 0.0
var _loading: bool = false
var _force_next: bool = false


func set_world(w: Dictionary) -> void:
	world = w
	for key in loaded_chunks.keys():
		loaded_chunks[key].queue_free()
	loaded_chunks.clear()
	_last_center = Vector2i(1 << 30, 1 << 30)


func force_refresh() -> void:
	_force_next = true


## Returns the pixel dict ({x,y,colorHex,ownerId,owner:{username},
## propertyId}) for a loaded pixel, or null if that pixel is unowned or
## outside the currently-streamed radius.
func get_pixel(x: int, y: int) -> Variant:
	return pixel_lookup.get("%d,%d" % [x, y])


func _process(delta: float) -> void:
	if player == null or world.is_empty():
		return
	_reload_timer -= delta
	if _reload_timer > 0.0 and not _force_next:
		return
	_reload_timer = RELOAD_INTERVAL

	var chunk_size := int(world.get("chunkSize", 64))
	var px := int(floor(player.global_transform.origin.x))
	var py := int(floor(player.global_transform.origin.z))
	var cx := int(floor(float(px) / chunk_size))
	var cy := int(floor(float(py) / chunk_size))

	if Vector2i(cx, cy) == _last_center and not _force_next:
		return
	if _loading:
		return

	_last_center = Vector2i(cx, cy)
	_force_next = false
	_reload_around(cx, cy, chunk_size)


func _reload_around(cx: int, cy: int, chunk_size: int) -> void:
	_loading = true
	var result := await Api.get_chunk(world.get("id"), cx, cy, RADIUS)
	_loading = false
	if not result.get("ok", false):
		return
	var data: Dictionary = result.get("data", {})
	var pixels: Array = data.get("pixels", [])

	var new_lookup: Dictionary = {}
	for p in pixels:
		new_lookup["%d,%d" % [int(p.get("x", 0)), int(p.get("y", 0))]] = p
	pixel_lookup = new_lookup

	var wanted: Dictionary = {}
	for dx in range(-RADIUS, RADIUS + 1):
		for dy in range(-RADIUS, RADIUS + 1):
			wanted["%d,%d" % [cx + dx, cy + dy]] = Vector2i(cx + dx, cy + dy)

	# Unload chunks outside the new radius.
	for key in loaded_chunks.keys():
		if not wanted.has(key):
			loaded_chunks[key].queue_free()
			loaded_chunks.erase(key)

	# Bucket the sparse pixel list by chunk coordinate.
	var buckets: Dictionary = {}
	for p in pixels:
		var pcx := int(floor(float(p.get("x", 0)) / chunk_size))
		var pcy := int(floor(float(p.get("y", 0)) / chunk_size))
		var key := "%d,%d" % [pcx, pcy]
		if not buckets.has(key):
			buckets[key] = []
		buckets[key].append(p)

	for key in wanted.keys():
		var coord: Vector2i = wanted[key]
		var chunk: Node3D = loaded_chunks.get(key)
		if chunk == null:
			chunk = Node3D.new()
			chunk.set_script(load("res://scripts/world/Chunk.gd"))
			add_child(chunk)
			chunk.setup(coord.x, coord.y, chunk_size, ground_material)
			loaded_chunks[key] = chunk
		chunk.set_pixels(buckets.get(key, []))
