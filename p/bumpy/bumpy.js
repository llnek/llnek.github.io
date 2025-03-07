/* Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright © 2025, Kenneth Leung. All rights reserved. */

;(function(window,UNDEF){

  "use strict";

	//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  function scenes(Mojo){

    const Q=window["io/czlab/mcfud/qtree"]();
    const int=Math.floor;
    const {Scenes:_Z,
			     Sprites:_S,
					 FX:_F,
			     v2:_V,
			     math:_M,
			     Game:_G,ute:_,is}=Mojo;

		//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      UI_FONT=Mojo.DOKI_LOWER,
		  SplashCfg= {
				title:"Jittery Blocks",
				action: {name:"PlayGame"},
				clickSnd:"click.mp3",
			};

		//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    _Z.scene("PlayGame",{
      setup(){
				let
				  K=Mojo.getScaleFactor(),
					H=int(Mojo.height*0.8),
					W=int(Mojo.width*0.8),
					top=_M.ndiv(Mojo.height-H,2),
					left=_M.ndiv(Mojo.width-W,2), right=left+W, bottom=top+H;
				_.inject(this.g,{
					initLevel(){
						_G.arena= {x1:left,x2:right,y1:top,y2:bottom};
						_G.qt= Q.quadtree(_G.arena);
						_G.items=[];
						let a=6*K,z=24*K; //dim of boxes
						for(let s,i=0;i<Mojo.u.items;++i){
							s={x: _.randInt2(left, right-z),
								 y: _.randInt2(top, bottom-z),
								 width : _.randInt2(a, z),
								 height : _.randInt2(a, z)};
							_G.items.push(_S.lift(s));
							s.g.checked=false;
							s.getBBox=()=>{
								return {x1:s.x,y1:s.y,
												x2:s.x+s.width,y2:s.y+s.height}
							};
							_V.set(s.m5.vel,_.randFloat2(-0.5*K,0.5*K),
															_.randFloat2(-0.5*K,0.5*K));
						}
					}
				});
				//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        this.insert(this.g.gfx=_S.graphics());
				this.g.initLevel();
				_Z.run("HUD");
      },
      _drawTree(node){
				let
				  g=this.g.gfx,
				  cs = node.subTrees(),
				  b,K=Mojo.getScaleFactor();
				if(!cs){
          b=node.boundingBox();
					g.rect(b.x1, b.y1, b.x2-b.x1,b.y2-b.y1);
					g.stroke({width:2*K, color:_S.SomeColors.red, alpha:0.2});
				}else{
          cs.forEach(c=> this._drawTree(c))
				}
			},
      _drawItems(){
				let
				  g=this.g.gfx,
					K=Mojo.getScaleFactor();
        _G.items.forEach(o=>{
					g.rect(o.x, o.y, o.width, o.height);
					if(o.g.checked) {
						g.stroke({width:1*K,color:_S.color("rgb(48,255,48)"),alpha:0.5});
					} else {
						g.stroke({width:1*K,color:_S.color("yellow"),alpha:0.5});
					}
        });
			},
      postUpdate(dt){
				this.g.gfx.clear();
				_G.qt.reset();
				_G.items.forEach(o=>{
					//move & clamp
					_V.add$(o,o.m5.vel);
					if(o.x<_G.arena.x1){ o.x=_G.arena.x1; o.m5.vel[0] *= -1; }
					if(o.x+o.width > _G.arena.x2){ o.x=_G.arena.x2-o.width; o.m5.vel[0] *= -1; }
					if(o.y<_G.arena.y1){ o.y=_G.arena.y1; o.m5.vel[1] *= -1; }
					if(o.y+o.height > _G.arena.y2){ o.y=_G.arena.y2-o.height; o.m5.vel[1] *= -1; }
					o.g.checked=false;
					_G.qt.insert(o);
				});
				let m;
				_G.items.forEach(o=>{
					_G.qt.search(o,true).forEach(c=>{
						if(m=this._collide(o,c)){
							o.g.checked = true;
							c.g.checked = true;
							if(m.dx < m.dy){
								if(m.dir[0] < 0){
									o.x = c.x - o.width;
								}else if(m.dir[0] > 0){
									o.x = c.x + c.width;
								}
								o.m5.vel[0] *= -1;
							}else{
								if(m.dir[1] < 0){
									o.y = c.y - o.height;
								}else if(m.dir[1] > 0){
									o.y = c.y + c.height;
								}
								o.m5.vel[1] *= -1;
							}
						}
					})
				});
				this._drawTree(_G.qt);
				this._drawItems();
      },
      _collide(r1, r2){
				let
				  r1w = int(r1.width/2),
					r2w = int(r2.width/2),
					r1h = int(r1.height/2),
					r2h = int(r2.height/2),
				  diffX = (r1.x + r1w) - (r2.x + r2w),
				  diffY = (r1.y + r1h) - (r2.y + r2h);
				if(Math.abs(diffX) < r1w + r2w &&
           Math.abs(diffY) < r1h + r2h){
					return {
						dx: (r1w+r2w) - Math.abs(diffX),
						dy: (r1h+r2h) - Math.abs(diffY),
						dir: [(diffX==0 ? 0 : diffX < 0 ? -1 : 1),
						      (diffY==0 ? 0 : diffY < 0 ? -1 : 1)]
					}
				}
      }
    });

		//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
		_Z.scene("HUD",{
			setup(){
				let
				  K=Mojo.getScaleFactor(),
					s= _S.bboxFrame(_G.arena,12*K);
				this.insert(s);
				s=_S.bitmapText("0",{ fontSize:24, fill:"#d4e64a"});
				this.g.count=0;
				this.msg=s;
				this.insert(s);
			},
			postUpdate(dt){
				if(++this.g.count >6){
					this.g.count=0;
					this.msg.text=`Items: ${Mojo.u.items}`+
						            `, FPS: ${Math.floor(1/dt)}`;
					this.msg.x=(Mojo.width-this.msg.width)/2;
					this.msg.y=_G.arena.y1 - 2 * this.msg.height; } }
		});

		_Z.run("Splash", SplashCfg);
  }

	//;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //load and run
	MojoH5Ldr({
		assetFiles: ["click.mp3"],
		arena: {width: 1344, height: 840},
    scaleToWindow:"max",
		scaleFit:"x",
    items:600,
    start(...args){ scenes(...args) }
	});

})(this);





