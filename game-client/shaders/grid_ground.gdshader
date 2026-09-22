shader_type spatial;
render_mode diffuse_lambert, specular_schlick_ggx;

// Draws the individual 1m = 1 pixel grid lines as part of the actual
// terrain mesh (never a 2D UI overlay), faded in only near the player so
// distant, unexplored ground reads as smooth flat gray - exactly the
// "walk up to land and see individual pixel boundaries appear" effect
// described in the design brief. One shared ShaderMaterial instance is
// used for every chunk's ground (see Main.gd `ground_material` /
// Chunk.gd), so updating `fade_center` once per frame updates the whole
// visible world at once instead of per-chunk.

uniform vec3 base_color : source_color = vec3(0.60, 0.60, 0.62);
uniform vec3 line_color : source_color = vec3(0.38, 0.38, 0.40);
uniform vec3 fade_center = vec3(0.0, 0.0, 0.0);
uniform float fade_radius : hint_range(2.0, 96.0) = 26.0;
uniform float line_width : hint_range(0.005, 0.2) = 0.035;
uniform float roughness_value : hint_range(0.0, 1.0) = 0.92;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 cell = fract(world_pos.xz);
	float line = 0.0;
	line = max(line, 1.0 - smoothstep(0.0, line_width, cell.x));
	line = max(line, 1.0 - smoothstep(0.0, line_width, cell.y));
	line = max(line, 1.0 - smoothstep(1.0 - line_width, 1.0, cell.x));
	line = max(line, 1.0 - smoothstep(1.0 - line_width, 1.0, cell.y));

	float dist = distance(world_pos.xz, fade_center.xz);
	float visibility = 1.0 - smoothstep(fade_radius * 0.55, fade_radius, dist);

	ALBEDO = mix(base_color, line_color, line * visibility);
	ROUGHNESS = roughness_value;
}
