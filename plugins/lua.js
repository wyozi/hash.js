var child_process	= require( "child_process" );
var EOF				= "\n\x1A";
var http			= require( "http" );

var lua = child_process.spawn( "lua.exe", [ "init.lua" ], {
	cwd: __dirname + "/lua"
} );

var cmdbuf = [];
var processing = false;

function QueueCommand( cmd ) {

	cmdbuf.push( cmd );

}

function ProcessCommand() {

	if ( processing )
		return;

	var cmd = cmdbuf.shift();

	if ( !cmd )
		return;

	processing = true;

	lua.stdin.write( cmd );
	lua.stdin.write( EOF );

}

setInterval( ProcessCommand, 10 );

function LuaQuote( str ) {

	str = str.split( "\0" ).join( "\\0" );
	str = str.split( EOF ).join( "\\n\\x1A" );
	str = str.split( "\"" ).join( "\\\"" );
	str = str.split( "\n" ).join( "\\n" );

	return "\"" + str + "\"";

}

function QueueHook( event, args ) {

	var buf = [ "> hook.Call(" ]

	if ( args && args.length > 0 ) {

		for ( var i = 0; i < args.length; i++ ) {

			buf.push( LuaQuote( args[ i ] ) );
			buf.push( "," );

		}

		buf.pop(); // Remove the trailing comma

	}

	buf.push( ")" );

	QueueCommand( buf.join( "" ) );

}

setInterval( function() {

	QueueHook( "Tick" );

	QueueCommand( "> timer.Tick()" );

}, 1000 );


var buf = [];

bot.on( "Message", function( name, steamID, msg ) {

	QueueCommand( "SteamID = " + steamID );

	QueueHook( "Message", [ name, steamID, msg ] );

	QueueCommand( msg.split( EOF ).join( "\\n\\x1A" ) );

} );

bot.on( "UserConnected", function( name, steamID ) {
	QueueHook( "Connected", [ name, steamID ] );
} );


bot.on( "UserDisconnected", function( name, steamID ) {
	QueueHook( "Disconnected", [ name, steamID ] );
} );

lua.stdout.on( "data", function( data ) {

	//
	// Handle multiple packets in a single chunk, or less
	//

	data = data.toString();

	var datas = data.split( EOF );

	buf.push( datas[ 0 ] );

	// Loop through all of our datas, except the last (unfinished) one
	for ( var i = 0; i < datas.length - 1; i++ ) {

		// Reconstruct our string
		buf = buf.join( "" );

		// Filter out unwanted shit
		buf = buf.split( "\0" ).join( "\\0" );
		buf = buf.split( "\t" ).join( "    " );

		// Ignore empty packets
		if ( buf.trim().length > 0 )
			bot.sendMessage( buf );

		buf = [ datas[ i + 1 ] ];
	}

	// We've received our packet. Prepare the next command!
	if ( buf.length == 1 && buf[0].length == 0 )
		processing = false;

} );